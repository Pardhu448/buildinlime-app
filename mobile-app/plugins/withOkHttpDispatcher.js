const { withMainApplication } = require("@expo/config-plugins")
const { mergeContents } = require("@expo/config-plugins/build/utils/generateCode")

/**
 * Raises OkHttp's per-host concurrency cap for React Native's networking client.
 *
 * OkHttp's Dispatcher defaults to maxRequestsPerHost = 5. The app holds one
 * Electric live long-poll open per synced collection (~10 of them), each parked
 * on the server for ~20s at a time, so those 5 slots are permanently occupied.
 * Every other call to the same host — most importantly a tRPC mutation POST —
 * then sits in the dispatcher queue until a long-poll returns, which is why a
 * message sent from mobile took ~20s to reach other devices, and why inbound
 * sync on every collection ran at roughly half its intended freshness.
 *
 * The cap counts calls, not connections, so HTTP/2 does NOT lift it — Electric's
 * documented browser fix (multiplex over h2 via a Caddy proxy) does not carry
 * over to React Native. It has to be raised natively, here.
 *
 * This lives in a config plugin rather than as a direct edit to MainApplication.kt
 * because android/ is gitignored (managed / CNG project): a hand-edit is wiped by
 * the next `expo prebuild --clean`, and it fails silently when it goes — the JS
 * keeps working and sync just quietly gets slow again.
 *
 * See web-app/code/agentGuides/shapeConcurrencyAndLazySync.md §1.
 */

// Generous rather than exact: the ceiling only needs to exceed
// (live shapes + in-flight mutations + uploads), and an idle long-poll costs a
// parked socket (~64KiB), not CPU. maxRequests stays above the per-host cap so
// the global limit can't become the new bottleneck.
const MAX_REQUESTS_PER_HOST = 32
const MAX_REQUESTS = 64

// Fully-qualified names throughout: injecting imports would risk colliding with
// whatever the MainApplication.kt template already imports, and that varies by
// Expo/RN version. Generated code, so the verbosity is a fair trade.
const FACTORY_CLASS = `private class BuildInLimeOkHttpClientFactory(
  private val context: android.content.Context,
) : com.facebook.react.modules.network.OkHttpClientFactory {
  override fun createNewNetworkModuleClient(): okhttp3.OkHttpClient {
    val dispatcher = okhttp3.Dispatcher().apply {
      maxRequestsPerHost = ${MAX_REQUESTS_PER_HOST}
      maxRequests = ${MAX_REQUESTS}
    }
    // Build from RN's context-aware builder, not the bare one: setting a factory
    // bypasses OkHttpClientProvider.createClient(context), so the 10MB response
    // cache RN would otherwise install has to be preserved explicitly here.
    return com.facebook.react.modules.network.OkHttpClientProvider
      .createClientBuilder(context)
      .dispatcher(dispatcher)
      .build()
  }
}`

// NetworkingModule builds its OkHttpClient through OkHttpClientProvider on first
// use and memoizes it, so a factory registered after loadReactNative() is ignored.
const FACTORY_REGISTRATION = `    com.facebook.react.modules.network.OkHttpClientProvider.setOkHttpClientFactory(
      BuildInLimeOkHttpClientFactory(applicationContext)
    )`

/**
 * mergeContents does not fail on a missing anchor — it splices near the end of the
 * file and reports success. That would produce a build with the cap quietly absent,
 * which is the exact failure mode this plugin exists to prevent, so check first.
 */
const assertAnchor = (contents, anchor, what) => {
  if (!contents.split("\n").some((line) => anchor.test(line))) {
    throw new Error(
      `withOkHttpDispatcher: no line in MainApplication.kt matches ${anchor} (${what}). ` +
        `The Expo template has changed — update the anchors in plugins/withOkHttpDispatcher.js.`,
    )
  }
}

const CLASS_ANCHOR = /class\s+MainApplication\s*:/
const INIT_ANCHOR = /loadReactNative\(this\)/

/** @type {import('@expo/config-plugins').ConfigPlugin} */
const withOkHttpDispatcher = (config) =>
  withMainApplication(config, (cfg) => {
    if (cfg.modResults.language !== "kt") {
      throw new Error(
        `withOkHttpDispatcher: expected a Kotlin MainApplication, got "${cfg.modResults.language}".`,
      )
    }

    assertAnchor(cfg.modResults.contents, CLASS_ANCHOR, "MainApplication class declaration")
    assertAnchor(cfg.modResults.contents, INIT_ANCHOR, "loadReactNative() call in onCreate")

    // Both merges are no-ops when the generated block is already present and
    // unchanged, so re-running prebuild is safe.
    const withClass = mergeContents({
      tag: "buildinlime-okhttp-dispatcher-class",
      src: cfg.modResults.contents,
      newSrc: FACTORY_CLASS,
      anchor: CLASS_ANCHOR,
      offset: 0, // immediately before the class declaration
      comment: "//",
    })

    const withRegistration = mergeContents({
      tag: "buildinlime-okhttp-dispatcher-init",
      src: withClass.contents,
      newSrc: FACTORY_REGISTRATION,
      anchor: INIT_ANCHOR,
      offset: 0, // immediately before loadReactNative()
      comment: "//",
    })

    const contents = withRegistration.contents
    if (
      !contents.includes("setOkHttpClientFactory") ||
      !contents.includes(`maxRequestsPerHost = ${MAX_REQUESTS_PER_HOST}`)
    ) {
      throw new Error(
        `withOkHttpDispatcher: post-condition failed — the dispatcher override is not present ` +
          `in the generated MainApplication.kt.`,
      )
    }

    cfg.modResults.contents = contents
    return cfg
  })

module.exports = withOkHttpDispatcher
