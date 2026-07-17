import { makePropertyActions } from "@buildinlime/sync-core"
import { propertiesCollection } from "../collections/communication"
import { getOfflineExecutor } from "../../infrastructure/offline/executor"

const {
  createPropertyAction,
  updatePropertyAction,
  deletePropertyAction,
  resetPropertyActions,
} = makePropertyActions({
  getExecutor: getOfflineExecutor,
  getCollection: () => propertiesCollection,
})

export {
  createPropertyAction,
  updatePropertyAction,
  deletePropertyAction,
  resetPropertyActions,
}
export type {
  CreatePropertyInput,
  UpdatePropertyInput,
  DeletePropertyInput,
} from "@buildinlime/sync-core"
