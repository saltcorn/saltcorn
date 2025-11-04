import { parseRelationPath } from "./relation_helpers";
import { RelationType, ViewDisplayType } from "./relation_types";

/**
 * Relation class
 * This is a more common interface for the relation string
 */
export class Relation {
  relationString: string;
  sourceTblName: string;
  targetTblName: string;
  viewDisplayType: any;
  subView?: any;
  path: any[];

  static fixedUserRelation = ".users._logged_in_ref_without_rel_";

  /**
   * @param relationString
   * @param targetTblName
   * @param subView
   */
  constructor(
    relationString: string,
    targetTblName: string,
    viewDisplayType: ViewDisplayType
  ) {
    this.relationString = relationString;
    this.targetTblName = targetTblName;
    this.viewDisplayType = viewDisplayType;
    if (this.isFixedRelation()) {
      this.sourceTblName = "users";
      this.path = [
        {
          fkey: "logged in user",
        },
      ];
    } else {
      const { sourcetable, path } = parseRelationPath(relationString);
      this.sourceTblName = sourcetable;
      this.path = path;
    }
  }

  /**
   * get the relation type
   */
  get type() {
    if (this.isFixedRelation()) return RelationType.RELATION_PATH;
    else if (this.path.length === 1 && this.path[0].inboundKey)
      return this.viewDisplayType === ViewDisplayType.NO_ROW_LIMIT
        ? RelationType.CHILD_LIST
        : ViewDisplayType.ROW_REQUIRED
          ? RelationType.ONE_TO_ONE_SHOW
          : null;
    // or throw ??
    else if (this.path.length === 2 && this.path.every((p) => p.inboundKey))
      return RelationType.CHILD_LIST;
    else if (this.path.length === 1 && this.path[0].fkey)
      return RelationType.PARENT_SHOW;
    else if (this.path.length === 0)
      return this.targetTblName && this.sourceTblName === this.targetTblName
        ? RelationType.OWN
        : RelationType.INDEPENDENT;
    else return RelationType.RELATION_PATH;
  }

  isFixedRelation() {
    return this.relationString === Relation.fixedUserRelation;
  }
}
