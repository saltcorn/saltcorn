const Router = require("express-promise-router");

const PageGroup = require("@saltcorn/data/models/page_group");
const PageGroupMember = require("@saltcorn/data/models/page_group_member");
const Page = require("@saltcorn/data/models/page");
const Form = require("@saltcorn/data/models/form");
const User = require("@saltcorn/data/models/user");
const { div, a, code, span, br } = require("@saltcorn/markup/tags");
const {
  renderForm,
  mkTable,
  post_btn,
  post_delete_btn,
  link,
} = require("@saltcorn/markup");
const { add_to_menu } = require("@saltcorn/admin-models/models/pack");
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
          onChange: `
  saveAndContinue(this, (res) => {
    history.replaceState(null, '', res.responseJSON.row.name);
    const arrowsVisible = $('#upDownArrowsId').length > 0;
    if (
      arrowsVisible && res.responseJSON.row.random_allocation ||
      !arrowsVisible && !res.responseJSON.row.random_allocation
    ) {
      window.location.reload();
    }    
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
        sublabel: req.__("A short name that will be in your URL"),
        attributes: { autofocus: true },
      },
      {
        name: "description",
        label: req.__("Description"),
        type: "String",
        sublabel: req.__("A longer description"),
      },
      {
        name: "min_role",
        label: req.__("Minimum role"),
        sublabel: req.__("Role required to access page"),
        input_type: "select",
        options: roles.map((r) => ({ value: r.id, label: r.role })),
      },
      {
        name: "random_allocation",
        label: req.__("Random allocation"),
        type: "Bool",
        sublabel: req.__(
          "Serve a random page, ignoring the eligible formula. " +
            "Within a session, reloads will always deliver the same page. " +
            "This is a basic requirement for A/B testing."
        ),
      },
    ],
  });
};

const memberForm = async (action, req, group, pageValidator) => {
  const pageOptions = (await Page.find()).map((p) => p.name);
  const fields = [
    {
      name: "page_name",
      label: req.__("Page"),
      sublabel: req.__("Page to be served"),
      type: "String",
      required: true,
      validator: pageValidator,
      attributes: {
        options: pageOptions,
      },
    },
    {
      name: "description",
      label: req.__("Description"),
      type: "String",
      sublabel: req.__("A description of the group member"),
    },
  ];
  if (!group.random_allocation) {
    fields.push({
      name: "eligible_formula",
      label: req.__("Eligible Formula"),
      sublabel:
        req.__("Formula to determine if this page should be served.") +
        br() +
        span(
          "Variables in scope: ",
          [
            "width",
            "height",
            "innerWidth",
            "innerHeight",
            "user",
            "locale",
            "device",
          ]
            .map((f) => code(f))
            .join(", ")
        ),
      help: {
        topic: "Eligible Formula",
      },
      type: "String",
      required: true,
      class: "validate-expression",
    });
  }
  return new Form({
    action,
    fields,
    additionalButtons: [
      {
        label: req.__("Cancel"),
        class: "btn btn-primary",
        onclick: `cancelMemberEdit('${group.name}');`,
      },
    ],
  });
};

const editMemberForm = async (member, req) => {
  const group = PageGroup.findOne({ id: member.page_group_id });
  const validator = (s, whole) => {
    const page = Page.findOne({ name: s });
    if (group.members.find((m) => m.page_id === page.id && +whole.id !== m.id))
      return req.__("A member with this page already exists");
  };
  return await memberForm(
    `/page_groupedit/edit-member/${member.id}`,
    req,
    group,
    validator
  );
};

const addMemberForm = async (group, req) => {
  const groupPages = await group.loadPages();
  const validator = (s) => {
    if (groupPages.find((page) => page.name === s))
      return req.__("A member with this page already exists");
  };
  return await memberForm(
    `/page_groupedit/add-member/${group.name}`,
    req,
    group,
    validator
  );
};

const wrapGroup = (contents, req) => {
  return {
    above: [
      {
        type: "breadcrumbs",
        crumbs: [
          { text: req.__("Page Groups"), href: "/pageedit" },
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
          { text: req.__("Pages"), href: "/pageedit" },
          { text: pageGroup.name, href: `/page_groupedit/${pageGroup.name}` },
          pageMember
            ? memberCrumb(pageMember.page_id)
            : { text: req.__("add-member") },
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

const pageGroupMembers = async (pageGroup, req) => {
  const db = require("@saltcorn/data/db");
  const pages = !db.isSQLite
    ? await Page.find({
        id: { in: pageGroup.members.map((r) => r.page_id) },
      })
    : await Page.find();
  const pageIdToName = pages.reduce((acc, page) => {
    acc[page.id] = page.name;
    return acc;
  }, {});
  let members = pageGroup.sortedMembers();
  const upDownBtns = (r, req) => {
    if (members.length <= 1) return "";
    else
      return div(
        { class: "container", id: "upDownArrowsId" },
        div(
          { class: "row" },
          div(
            { class: "col-1" },
            r.sequence !== members[0].sequence
              ? post_btn(
                  `/page_groupedit/move-member/${r.id}/Up`,
                  `<i class="fa fa-arrow-up"></i>`,
                  req.csrfToken(),
                  {
                    small: true,
                    ajax: true,
                    reload_on_done: true,
                    btnClass: "btn btn-secondary btn-sm me-1",
                    req,
                    formClass: "d-inline",
                  }
                )
              : ""
          ),
          div(
            { class: "col-1" },
            r.sequence !== members[members.length - 1].sequence
              ? post_btn(
                  `/page_groupedit/move-member/${r.id}/Down`,
                  `<i class="fa fa-arrow-down"></i>`,
                  req.csrfToken(),
                  {
                    small: true,
                    ajax: true,
                    reload_on_done: true,
                    btnClass: "btn btn-secondary btn-sm me-1",
                    req,
                    formClass: "d-inline",
                  }
                )
              : ""
          )
        )
      );
  };
  const tblArr = [
    {
      label: req.__("Page"),
      key: (r) =>
        link(`/page/${pageIdToName[r.page_id]}`, pageIdToName[r.page_id]),
    },
  ];
  if (!pageGroup.random_allocation) {
    tblArr.push({
      label: "",
      key: (r) => upDownBtns(r, req),
    });
  }
  tblArr.push(
    {
      label: req.__("Edit"),
      key: (member) =>
        link(`/page_groupedit/edit-member/${member.id}`, req.__("Edit")),
    },
    {
      label: req.__("Delete"),
      key: (member) =>
        post_delete_btn(
          `/page_groupedit/remove-member/${member.id}`,
          req,
          req.__("Member %s", member.sequence)
        ),
    }
  );
  return mkTable(tblArr, members, {
    hover: true,
  });
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
    res.sendWrap(req.__("%s edit", page_groupname), {
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
          title: req.__("Edit group properties"),
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
    const form = await groupPropsForm(req, !(req.body || {}).id);
    form.hidden("id");
    form.validate(req.body || {});
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
        req.__(`%s add-member`, group.name),
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
    form.validate(req.body || {});
    if (form.hasErrors) {
      res.sendWrap(
        req.__(`%s add-member`, group.name),
        wrapMember(renderForm(form, req.csrfToken()), req, group)
      );
    } else {
      const { page_name, eligible_formula, description } = form.values;
      const page = Page.findOne({ name: page_name });
      if (!page) {
        req.flash("error", req.__("Page %s not found", page_name));
        res.sendWrap(
          req.__(`%s add-member`, group.name),
          wrapMember(renderForm(form, req.csrfToken()), req, group)
        );
      } else {
        await group.addMember({
          page_id: page.id,
          eligible_formula,
          description: description || "",
        });
        req.flash("success", req.__("Added member"));
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
      req.flash("error", req.__("member %s does not exist", member_id));
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
      req.__(`%s edit-member`, member.name || member.id),
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
    form.validate(req.body || {});
    if (form.hasErrors) {
      res.sendWrap(
        req.__(`%s edit-member`, member.name || member.id),
        wrapMember(renderForm(form, req.csrfToken()), req, group, member)
      );
    } else {
      const { id, page_name, eligible_formula, description } = form.values;
      const page = Page.findOne({ name: page_name });
      if (!page) {
        req.flash("error", req.__("Page %s not found", page_name));
        res.redirect(`/page_groupedit/${group.name}`);
      } else
        await PageGroupMember.update(id, {
          page_group_id: group.id,
          page_id: page.id,
          eligible_formula,
          description: description || "",
        });
      req.flash("success", req.__("Updated member"));
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
          req.flash(
            "success",
            req.__("Removed member %s", member.name || member_id)
          );
          res.redirect(`/page_groupedit/${group.name}`);
        } catch (e) {
          console.error(e);
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
          'Page %s added to menu. Adjust access permissions in <a href="/menu">Settings &raquo; Menu</a>',
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
