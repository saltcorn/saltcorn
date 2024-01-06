const Router = require("express-promise-router");

const PageGroup = require("@saltcorn/data/models/page_group");
const PageGroupMember = require("@saltcorn/data/models/page_group_member");
const Page = require("@saltcorn/data/models/page");
const Form = require("@saltcorn/data/models/form");
const User = require("@saltcorn/data/models/user");
const { div, a } = require("@saltcorn/markup/tags");
const { renderForm } = require("@saltcorn/markup");
const { add_to_menu } = require("@saltcorn/admin-models/models/pack");
const { pageGroupMembers } = require("./common_lists");
const { error_catcher, isAdmin, setRole } = require("./utils.js");
const { getState } = require("@saltcorn/data/db/state");

const router = new Router();
module.exports = router;

const groupPropsForm = async (req, isNew) => {
  const roles = await User.get_roles();
  const pages = await Page.find();
  const groups = await PageGroup.find();
  return new Form({
    action: "/page_groupedit/edit-properties",
    ...(isNew
      ? {}
      : {
          onChange: `saveAndContinue(this, (res) => {
  history.replaceState(null, '', res.responseJSON.row.name);
});`,
        }),
    noSubmitButton: !isNew,
    fields: [
      {
        name: "name",
        label: req.__("Name"),
        type: "String",
        required: true,
        validator(s, whole) {
          if (s.length < 1) return req.__("Missing name");
          if (pages.find((p) => p.name === s))
            return req.__("A page with this name already exists");
          if (
            groups.find((g) =>
              !isNew ? g.name === s && g.id !== +whole.id : g.name === s
            )
          ) {
            return req.__("A page group with this name already exists");
          }
        },
      },
      {
        name: "description",
        label: req.__("Description"),
        type: "String",
      },
      {
        name: "min_role",
        label: req.__("Minimum role"),
        sublabel: req.__("Role required to access page"),
        input_type: "select",
        options: roles.map((r) => ({ value: r.id, label: r.role })),
      },
    ],
  });
};

const memberForm = async (action, nameValidator, req, groupName) => {
  const pageOptions = (await Page.find()).map((p) => p.name);
  return new Form({
    action,
    fields: [
      {
        name: "name",
        label: req.__("Name"),
        sublabel: req.__("Name of this member"),
        type: "String",
        validator: nameValidator,
      },
      {
        name: "description",
        label: req.__("Description"),
        type: "String",
      },
      {
        name: "page_name",
        label: req.__("Page"),
        sublabel: req.__("Page to be delivered"),
        type: "String",
        required: true,
        attributes: {
          options: pageOptions,
        },
      },
      {
        name: "eligible_formula",
        label: req.__("Eligible Formula"),
        sublabel: req.__(
          "Formula to determine if this page should be delivered"
        ),
        type: "String",
        required: true,
        class: "validate-expression",
      },
    ],
    additionalButtons: [
      {
        label: req.__("Cancel"),
        class: "btn btn-primary",
        onclick: `cancelMemberEdit('${groupName}');`,
      },
    ],
  });
};

const editMemberForm = async (member, req) => {
  const group = PageGroup.findOne({ id: member.page_group_id });
  const nameToMember = {};
  for (const member of group.members) {
    if (member.name) nameToMember[member.name] = member;
  }
  const validator = (s, whole) => {
    if (s && nameToMember[s] && +whole.id !== nameToMember[s].id) {
      return req.__("A member with this name already exists");
    }
  };
  return await memberForm(
    `/page_groupedit/edit-member/${member.id}`,
    validator,
    req,
    group.name
  );
};

const addMemberForm = async (group, req) => {
  const nameToMember = {};
  for (const member of group.members) {
    if (member.name) nameToMember[member.name] = member;
  }
  const validator = (s) => {
    if (s && nameToMember[s]) {
      return req.__("A member with this name already exists");
    }
  };
  return await memberForm(
    `/page_groupedit/add-member/${group.name}`,
    validator,
    req,
    group.name
  );
};

const wrapGroup = (contents, req) => {
  return {
    above: [
      {
        type: "breadcrumbs",
        crumbs: [
          { text: req.__("Page Groups"), href: "/pageedit" }, // anchor ??
          { text: req.__("Create") },
        ],
      },
      {
        type: "card",
        title: req.__("New"),
        contents,
      },
    ],
  };
};

const wrapMember = (contents, req, pageGroup, pageMember) => {
  const memberCrumb = (pageId) => {
    const page = Page.findOne({ id: pageId });
    return page ? { text: page.name, href: `/page/${page.name}` } : {};
  };
  return {
    above: [
      {
        type: "breadcrumbs",
        crumbs: [
          { text: req.__("Pages"), href: "/pageedit" }, // anchor ??
          { text: pageGroup.name, href: `/page_groupedit/${pageGroup.name}` },
          pageMember
            ? memberCrumb(pageMember.page_id)
            : { text: req.__("Add member") },
        ],
      },
      {
        type: "card",
        title: pageMember
          ? req.__("edit member of %s", pageGroup.name)
          : req.__("add member to %s", pageGroup.name),
        contents,
      },
    ],
  };
};

/**
 * load a form to create a new page group
 */
router.get(
  "/new",
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await groupPropsForm(req, true);
    res.sendWrap(
      req.__(`New page group`),
      wrapGroup(renderForm(form, req.csrfToken()), req)
    );
  })
);

/**
 * load the page group editor
 */
router.get(
  "/:page_groupname",
  isAdmin,
  error_catcher(async (req, res) => {
    const { page_groupname } = req.params;
    const pageGroup = PageGroup.findOne({ name: page_groupname });
    const propertiesForm = await groupPropsForm(req);
    propertiesForm.hidden("id");
    propertiesForm.values = pageGroup;
    res.sendWrap(req.__("Pagegroup edit"), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [
            { text: req.__("Pages"), href: "/pageedit" },
            {
              text: pageGroup.name,
              href: `/page/${page_groupname}`,
              pageGroupLink: true,
            },
          ],
        },
        {
          type: "card",
          title: req.__("Members"),
          contents: div(
            await pageGroupMembers(pageGroup, req),
            a(
              {
                href: `/page_groupedit/add-member/${pageGroup.name}`,
                class: "btn btn-primary",
              },
              req.__("Add member")
            )
          ),
        },
        {
          type: "card",
          title: req.__("Edit group Properties"),
          titleAjaxIndicator: true,
          contents: div(renderForm(propertiesForm, req.csrfToken())),
        },
      ],
    });
  })
);
/**
 * edit the properties of a page group
 */
router.post(
  "/edit-properties",
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await groupPropsForm(req, !req.body.id);
    form.hidden("id");
    form.validate(req.body);
    if (form.hasErrors) {
      if (!req.xhr) {
        // from new
        res.sendWrap(
          req.__(`Pagegroup attributes`),
          wrapGroup(renderForm(form, req.csrfToken()), req)
        );
      } else {
        // from edit
        const error = form.errorSummary;
        getState().log(2, `POST /page_groupedit/edit-properties: '${error}'`);
        res.status(400).json({ notify: { type: "danger", text: error } });
      }
    } else {
      const { id, ...row } = form.values;
      if (+id) {
        await PageGroup.update(id, row);
        res.json({ success: "ok", row });
      } else {
        const pageGroup = await PageGroup.create(row);
        res.redirect(`/page_groupedit/${pageGroup.name}`);
      }
    }
  })
);

/**
 * load a form to add a member to a group
 */
router.get(
  "/add-member/:page_groupname",
  isAdmin,
  error_catcher(async (req, res) => {
    const { page_groupname } = req.params;
    const group = PageGroup.findOne({ name: page_groupname });
    if (!group) {
      req.flash("error", req.__("Page group %s not found", page_groupname));
      res.redirect(`/page_groupedit/${page_groupname}`);
    } else {
      const form = await addMemberForm(group, req);
      res.sendWrap(
        req.__(`Pagegroup attributes`),
        wrapMember(renderForm(form, req.csrfToken()), req, group)
      );
    }
  })
);

/**
 * add a member to a group
 */
router.post(
  "/add-member/:page_groupname",
  isAdmin,
  error_catcher(async (req, res) => {
    const { page_groupname } = req.params;
    const group = PageGroup.findOne({ name: page_groupname });
    if (!group) {
      req.flash("error", req.__("Page group %s not found", page_groupname));
      res.redirect(`/page_groupedit/${page_groupname}`);
    }
    const form = await addMemberForm(group, req);
    form.validate(req.body);
    if (form.hasErrors) {
      res.sendWrap(
        req.__(`Pagegroup attributes`),
        wrapMember(renderForm(form, req.csrfToken()), req, group)
      );
    } else {
      const { page_name, eligible_formula, name, description } = form.values;
      const page = Page.findOne({ name: page_name });
      if (!page) {
        req.flash("error", req.__("Page %s not found", page_name));
        res.sendWrap(
          req.__(`Pagegroup attributes`),
          wrapMember(renderForm(form, req.csrfToken()), req, group)
        );
      } else {
        await group.addMember({
          page_id: page.id,
          eligible_formula,
          name: name || "",
          description: description || "",
        });
        req.flash("success", req.__("Added member %s", name || page_name));
        res.redirect(`/page_groupedit/${page_groupname}`);
      }
    }
  })
);

/**
 * move a group-member up/dowm
 */
router.post(
  "/move-member/:member_id/:mode",
  isAdmin,
  error_catcher(async (req, res) => {
    const { member_id, mode } = req.params;
    try {
      const member = PageGroupMember.findOne({ id: member_id });
      const pageGroup = PageGroup.findOne({ id: member.page_group_id });
      await pageGroup.moveMember(member, mode);
      res.json({ success: "ok" });
    } catch (error) {
      getState().log(2, `POST /page_groupedit/move-member: '${error.message}'`);
      res.status(400).json({ error: error.message || error });
    }
  })
);

/**
 * load a form to edit a group-member
 */
router.get(
  "/edit-member/:member_id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { member_id } = req.params;
    const member = PageGroupMember.findOne({ id: member_id });
    if (!member) {
      req.flash("error", req.__("Group member %s does not exist", member_id));
      return res.redirect("/pageedit");
    }
    const group = PageGroup.findOne({ id: member.page_group_id });
    if (!group) {
      req.flash(
        "error",
        req.__("Page group %s not found", member.page_group_id)
      );
      return res.redirect("/pageedit");
    }
    const page = Page.findOne({ id: member.page_id });
    if (!page) {
      req.flash("error", req.__("Page %s not found", member.page_id));
      return res.redirect(`/page_groupedit/${group.name}`);
    }
    const form = await editMemberForm(member, req);
    form.hidden("id");
    form.values = { ...member, page_name: page.name };

    res.sendWrap(
      req.__(`Pagegroup attributes`),
      wrapMember(renderForm(form, req.csrfToken()), req, group, member)
    );
  })
);

/**
 * edit a member of a group
 */
router.post(
  "/edit-member/:member_id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { member_id } = req.params;
    const member = PageGroupMember.findOne({ id: member_id });
    const group = PageGroup.findOne({ id: member.page_group_id });
    const form = await editMemberForm(member, req);
    form.hidden("id");
    form.validate(req.body);
    if (form.hasErrors) {
      res.sendWrap(
        req.__(`Pagegroup attributes`),
        wrapMember(renderForm(form, req.csrfToken()), req, group, member)
      );
    } else {
      const { id, page_name, eligible_formula, name, description } =
        form.values;
      const page = Page.findOne({ name: page_name });
      if (!page) {
        req.flash("error", req.__("Page %s not found", page_name));
        res.redirect(`/page_groupedit/${group.name}`);
      } else
        await PageGroupMember.update(id, {
          page_group_id: group.id,
          page_id: page.id,
          eligible_formula,
          name: name || "",
          description: description || "",
        });
      req.flash(
        "success",
        req.__("Updated member %s", member.name ? member.name : member.id)
      );
      res.redirect(`/page_groupedit/${group.name}`);
    }
  })
);

/**
 * delete a group
 */
router.post(
  "/delete/:group_id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { group_id } = req.params;
    const group = PageGroup.findOne({ id: group_id });
    if (!group) {
      req.flash("error", req.__("Page group %s not found", group_id));
      res.redirect("/pageedit");
    } else {
      await group.delete();
      req.flash("success", req.__("Deleted page group %s", group_id));
      res.redirect("/pageedit");
    }
  })
);

/**
 * delete a group-member
 */
router.post(
  "/remove-member/:member_id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { member_id } = req.params;
    const member = PageGroupMember.findOne({ id: member_id });
    if (!member) {
      req.flash("error", req.__("Page group member %s not found", member_id));
      res.redirect("/pageedit");
    } else {
      const group = PageGroup.findOne({ id: member.page_group_id });
      if (!group) {
        req.flash(
          "error",
          req.__("Page group %s not found", member.page_group_id)
        );
        res.redirect("/pageedit");
      } else {
        try {
          await group.removeMember(member_id);
          req.flash("success", req.__("Removed member %s", member.name));
          res.redirect(`/page_groupedit/${group.name}`);
        } catch (e) {
          req.flash("error", e.message);
          res.redirect(`/page_groupedit/${group.name}`);
        }
      }
    }
  })
);

/**
 * clone a group
 */
router.post(
  "/clone/:id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const group = PageGroup.findOne({ id });
    if (!group) {
      req.flash("error", req.__("Page group %s not found", id));
      res.redirect("/pageedit");
    } else {
      const copy = await group.clone();
      req.flash("success", req.__("Cloned page group %s", group.name));
      res.redirect(`/page_groupedit/${copy.name}`);
    }
  })
);

/**
 * clone a group-member
 */
router.post(
  "/clone-member/:member_id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { member_id } = req.params;
    const member = PageGroupMember.findOne({ id: member_id });
    const group = PageGroup.findOne({ id: member.page_group_id });
    if (!member) {
      req.flash("error", req.__("Page group member %s not found", member_id));
      res.redirect(group ? `/page_groupedit/${group.name}` : "/pageedit");
    } else if (!member.name) {
      req.flash("error", req.__("Please give the member a name"));
      res.redirect(group ? `/page_groupedit/${group.name}` : "/pageedit");
    } else {
      const copy = await member.clone();
      req.flash("success", req.__("Cloned page group member %s", member.name));
      res.redirect(`/page_groupedit/edit-member/${copy.id}`);
    }
  })
);

/**
 * add a pagegroup-link to the menu
 */
router.post(
  "/add-to-menu/:id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const group = PageGroup.findOne({ id });
    if (!group) {
      req.flash("error", req.__("Page group %s not found", id));
      res.redirect("/pageedit");
    } else {
      await add_to_menu({
        label: group.name,
        type: "Page", // TODO PageGroup
        min_role: group.min_role,
        pagename: group.name,
      });
      req.flash(
        "success",
        req.__(
          "Page %s added to menu. Adjust access permissions in Settings &raquo; Menu",
          group.name
        )
      );
      res.redirect(`/pageedit`);
    }
  })
);

/**
 * set the role of a group
 */
router.post(
  "/setrole/:id",
  isAdmin,
  error_catcher(async (req, res) => {
    await setRole(req, res, PageGroup);
  })
);
