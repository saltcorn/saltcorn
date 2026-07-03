/**
 * @category server
 * @module markup/forms
 * @subcategory markup
 */

import {
  form,
  select,
  option,
  text,
  label,
  input,
} from "@saltcorn/markup/tags";
import { csrfField } from "../routes/utils.js";
import Role from "@saltcorn/data/models/role";
import { Req } from "@saltcorn/types/base_types";

/**
 * Edit Role form (for admin)
 * @param {object} opts
 * @param {string} opts.url
 * @param {Role} opts.current_role
 * @param {Role[]} opts.roles
 * @param {object} opts.req
 * @returns {Form}
 */
const editRoleForm = ({
  url,
  current_role,
  roles,
  req,
}: {
  url: string;
  current_role: number;
  roles: Role[];
  req: Req;
}) =>
  form(
    {
      action: url,
      method: "post",
      onchange: "saveAndContinue(this)",
    },
    csrfField(req),
    select(
      {
        name: "role",
        class: "w-unset form-select form-select-sm",
      },
      roles.map((role) =>
        option(
          {
            value: role.id,
            ...(current_role === role.id && { selected: true }),
          },
          text(role.role)
        )
      )
    )
  );

/**
 * File upload form (for admin)
 * @param {object} req
 * @param folder
 * @returns {Form}
 */
const fileUploadForm = (req: Req, folder?: string) => {
  const frm = form(
    {
      action: "/files/upload",
      method: "post",
      enctype: "multipart/form-data",
    },
    csrfField(req),
    label(req.__("Upload file(s)")),
    input({
      name: "file",
      class: "form-control ms-1 w-unset d-inline",
      type: "file",
      onchange: "handle_upload_file_change(form)",
      multiple: true,
    }),
    folder &&
      input({
        id: "uploadFolderInpId",
        type: "hidden",
        name: "folder",
        value: folder,
      })
  );
  return frm;
};

/**
 * Get Wizard Card Title
 * @param {string} wizardTitle
 * @param {*} wf
 * @param {object} wfres
 * @returns {string}
 */
const wizardCardTitle = (wizardTitle: string, wf: any, wfres: any) =>
  `${wizardTitle}: ${wfres.stepName}`;

export { editRoleForm, wizardCardTitle, fileUploadForm };
