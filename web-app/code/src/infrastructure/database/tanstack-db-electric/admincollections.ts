// MIGRATION SHIM — all ~21 existing importers continue to work unchanged.
// Source of truth has moved to application/collections/*.
// Remove this file once all importers have been updated to import directly.
export * from "%/application/collections/admin"
export * from "%/application/collections/organization"
export * from "%/application/collections/communication"
