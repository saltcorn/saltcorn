/**
 * init fixtures
 * @category saltcorn-data
 * @module db/fixtures
 * @subcategory db
 */
const db = require(".");
const { getState } = require("./state");
const Table = require("../models/table");
const Field = require("../models/field");
const File = require("../models/file");
const View = require("../models/view");
const User = require("../models/user");
const Page = require("../models/page");
const Tag = require("../models/tag");
const Model = require("../models/model");
const ModelInstance = require("../models/model_instance");
const fs = require("fs").promises;

module.exports =
  /**
   * @function
   * @name "module.exports function"
   * @returns {Promise<void>}
   */
  async () => {
    getState().registerPlugin("base", require("../base-plugin"));
    const table = await Table.create("books", {
      min_role_read: 100,
      min_role_write: 1,
    });
    await Field.create({
      table,
      name: "author",
      label: "Author",
      type: "String",
      required: true,
    });
    await Field.create({
      table,
      name: "pages",
      label: "Pages",
      type: "Integer",
      required: true,
      attributes: { min: 0 },
    });
    const patients = await Table.create("patients", {
      min_role_read: 40,
    });
    await Field.create({
      table: patients,
      name: "name",
      label: "Name",
      type: "String",
      required: true,
    });
    await Field.create({
      table: patients,
      name: "favbook",
      label: "Favourite book",
      type: "Key",
      reftable: table,
      required: false,
      attributes: { summary_field: "author" },
    });
    await Field.create({
      table: patients,
      name: "parent",
      label: "Parent",
      type: "Key",
      reftable: patients,
      required: false,
      attributes: { summary_field: "name" },
    });
    const authorList = await View.create({
      table_id: table.id,
      name: "authorlist",
      viewtemplate: "List",
      configuration: {
        columns: [
          { type: "Field", field_name: "author", state_field: "on" },
          { type: "ViewLink", view: "Own:authorshow" },
          { type: "Action", action_name: "Delete" },
          {
            type: "Aggregation",
            agg_relation: "patients.favbook",
            agg_field: "name",
            stat: "Count",
          },
        ],
      },
      min_role: 100,
    });
    const authorShow = await View.create({
      table_id: table.id,
      name: "authorshow",
      viewtemplate: "Show",
      configuration: {
        columns: [
          { type: "Field", field_name: "author", state_field: "on" },
          { type: "ViewLink", view: "Own:authorshow" },
          { type: "Action", action_name: "Delete" },
          {
            type: "Aggregation",
            agg_relation: "patients.favbook",
            agg_field: "name",
            stat: "Count",
          },
        ],
        layout: {
          above: [{ type: "field", fieldview: "show", field_name: "author" }],
        },
      },
      min_role: 100,
    });
    const authorEdit = await View.create({
      table_id: table.id,
      name: "authoredit",
      viewtemplate: "Edit",
      configuration: {
        columns: [{ type: "Field", field_name: "author" }],
        layout: {
          above: [{ type: "field", fieldview: "edit", field_name: "author" }],
        },
        fixed: {
          pages: 678,
        },
        view_when_done: "authorlist",
      },
      min_role: 100,
    });

    await View.create({
      table_id: patients.id,
      name: "patientlist",
      viewtemplate: "List",
      configuration: {
        columns: [
          { type: "Field", field_name: "name" },
          { type: "Field", field_name: "favbook" },
          { type: "Field", field_name: "parent" },
          { type: "Field", field_name: "favbook" },
          { type: "JoinField", join_field: "favbook.author" },
          { type: "JoinField", join_field: "favbook.pages" },
        ],
      },
      min_role: 80,
    });
    const readings = await Table.create("readings");
    await Field.create({
      table: readings,
      name: "temperature",
      label: "Temperature",
      type: "Integer",
      required: true,
    });
    await Field.create({
      table: readings,
      name: "patient_id",
      label: "Patient",
      type: "Key",
      reftable: patients,
      attributes: { summary_field: "name" },
      required: true,
    });
    await Field.create({
      table: readings,
      name: "normalised",
      label: "Normalised",
      type: "Bool",
    });
    await Field.create({
      table: readings,
      name: "date",
      label: "Date",
      type: "Date",
    });
    const disc_books = await Table.create("discusses_books", {
      min_role_read: 40,
    });
    await Field.create({
      table: disc_books,
      name: "book",
      label: "book",
      type: "Key",
      reftable: table,
      required: false,
      attributes: { summary_field: "author" },
    });
    await Field.create({
      table: disc_books,
      name: "discussant",
      label: "discussant",
      type: "Key",
      reftable_name: "users",
      attributes: { summary_field: "email" },
      required: false,
    });
    const publisher = await Table.create("publisher");
    await Field.create({
      table: publisher,
      name: "name",
      label: "Name",
      type: "String",
      required: true,
    });
    await Field.create({
      table: table, // ie books
      name: "publisher",
      label: "Publisher",
      type: "Key",
      attributes: { summary_field: "name" },
      reftable: publisher,
      required: false,
    });
    const ak_id = await db.insert("publisher", { name: "AK Press" });
    await db.insert("publisher", { name: "No starch" });

    await db.insert("books", { author: "Herman Melville", pages: 967 });
    await db.insert("books", {
      author: "Leo Tolstoy",
      pages: 728,
      publisher: ak_id,
    });
    const kirk_id = await db.insert("patients", {
      name: "Kirk Douglas",
      favbook: 1,
    });
    const michael_id = await db.insert("patients", {
      name: "Michael Douglas",
      favbook: 2,
      parent: kirk_id,
    });
    const date = new Date("2019-11-11T10:34:00.000Z");
    await db.insert("readings", {
      temperature: 37,
      patient_id: kirk_id,
      normalised: true,
      date: db.isSQLite ? date.toString() : date,
    });
    await db.insert("readings", {
      temperature: 39,
      patient_id: kirk_id,
      normalised: false,
    });
    await db.insert("readings", {
      temperature: 37,
      patient_id: michael_id,
      normalised: false,
    });
    const now = new Date();
    await User.create({
      email: "admin@foo.com",
      password: "AhGGr6rhu45",
      role_id: 1,
      last_mobile_login: db.isSQLite ? now.valueOf() : now,
    });
    await User.create({
      email: "staff@foo.com",
      password: "ghrarhr54hg",
      role_id: 40,
      last_mobile_login: db.isSQLite ? now.valueOf() : now,
    });
    await User.create({
      email: "user@foo.com",
      password: "GFeggwrwq45fjn",
      role_id: 80,
      last_mobile_login: db.isSQLite ? now.valueOf() : now,
    });
    await File.ensure_file_store();
    const mv = async (fnm) => {
      await fs.writeFile(fnm, "cecinestpasunpng");
    };
    await File.from_req_files(
      { mimetype: "image/png", name: "magrite.png", mv, size: 245752 },
      1,
      100
    );
    await Page.create({
      name: "a_page",
      title: "grgw",
      description: "rgerg",
      min_role: 100,
      layout: {
        above: [
          {
            type: "blank",
            block: false,
            contents: "Hello world",
            textStyle: "",
          },
          { type: "line_break" },
          { type: "blank", isHTML: true, contents: "<h1> foo</h1>" },
          {
            url: "https://saltcorn.com/",
            text: "Click here",
            type: "link",
            block: false,
            textStyle: "",
          },
          {
            type: "card",
            title: "header",
            contents: {
              above: [
                null,
                {
                  aligns: ["left", "left"],
                  widths: [6, 6],
                  besides: [
                    {
                      above: [
                        null,
                        {
                          type: "blank",
                          block: false,
                          contents: "Hello world",
                          textStyle: "",
                        },
                      ],
                    },
                    {
                      above: [
                        null,
                        {
                          type: "blank",
                          block: false,
                          contents: "Bye bye",
                          textStyle: "",
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
      fixed_states: {},
    });
    await Page.create({
      name: "page_with_html_file",
      title: "page with html file",
      description: "This page uses a fixed HTML file",
      min_role: 100,
      layout: {
        html_file: "test.html",
      },
      fixed_states: {},
    });

    await Page.create({
      name: "page_with embedded_html_page",
      title: "page with embedded html page",
      description: "This page embeds another page with fixed HTML",
      min_role: 100,
      layout: {
        above: [
          {
            type: "page",
            page: "page_with_html_file",
          },
        ],
      },
      fixed_states: {},
    });

    await View.create({
      table_id: disc_books.id,
      name: "disc_books_edit-in-edit",
      viewtemplate: "Edit",
      configuration: {
        layout: {
          above: [
            {
              type: "field",
              block: false,
              fieldview: "select",
              textStyle: "",
              field_name: "discussant",
              configuration: {},
            },
          ],
        },
        columns: [
          {
            type: "Field",
            block: false,
            fieldview: "select",
            textStyle: "",
            field_name: "discussant",
            configuration: {},
          },
        ],
      },
      min_role: 100,
    });

    await View.create({
      table_id: disc_books.id,
      name: "disc_books_list",
      viewtemplate: "List",
      configuration: {
        columns: [
          { type: "Field", field_name: "book", state_field: "on" },
          { type: "Field", field_name: "discussant", state_field: "on" },
        ],
      },
      min_role: 100,
    });

    await View.create({
      table_id: table.id,
      name: "show_author_with_disc_books_list",
      viewtemplate: "Show",
      configuration: {
        columns: [
          { type: "Field", field_name: "author", state_field: "on" },
          {
            type: "ViewLink",
            view: "disc_books_list",
            block: false,
            label: "",
            minRole: 100,
            link_icon: "",
          },
        ],
        layout: {
          above: [
            { type: "field", field_name: "author", fieldview: "show" },
            {
              type: "view",
              view: "ChildList:disc_books_list.discusses_books.book",
              name: "7b17af",
              state: "shared",
            },

            {
              type: "view_link",
              view: "ChildList:disc_books_list.discusses_books.book",
              block: false,
              minRole: 100,
              isFormula: {},
              link_icon: "",
              view_label: "",
            },
          ],
        },
      },
      min_role: 100,
    });

    await View.create({
      table_id: table.id,
      name: "author_multi_edit",
      viewtemplate: "Edit",
      configuration: {
        columns: [
          { type: "Field", field_name: "author" },
          { type: "Field", field_name: "publisher", fieldview: "select" },
          {
            type: "action",
            block: false,
            configuration: {},
            action_name: "UpdateMatchingRows",
            action_style: "btn-primary",
            minRole: 100,
            rndid: "f7c2cd",
          },
        ],
        layout: {
          above: [
            { type: "field", fieldview: "edit", field_name: "author" },
            {
              type: "field",
              field_name: "publisher",
              fieldview: "select",
            },
            {
              type: "action",
              block: false,
              configuration: {},
              action_name: "UpdateMatchingRows",
              action_style: "btn-primary",
              minRole: 100,
              rndid: "f7c2cd",
            },
            {
              name: "7b17af",
              type: "view",
              view: "ChildList:disc_books_edit-in-edit.discusses_books.book",
              state: "shared",
            },
          ],
        },
      },
      min_role: 100,
    });

    const rooms = await Table.create("rooms", {
      min_role_read: 80,
      min_role_write: 80,
    });
    await Field.create({
      table: rooms,
      name: "name",
      label: "Name",
      type: "String",
      required: true,
    });
    await db.insert("rooms", {
      name: "Room A",
    });
    await db.insert("rooms", {
      name: "Room B",
    });

    const messages = await Table.create("messages", {
      min_role_read: 80,
      min_role_write: 80,
    });
    await Field.create({
      table: messages,
      name: "content",
      label: "Content",
      type: "String",
      required: true,
    });
    await Field.create({
      table: messages,
      name: "user",
      label: "User",
      type: "Key",
      reftable_name: "users",
      attributes: { summary_field: "email" },
      required: false,
    });
    await Field.create({
      table: messages,
      name: "room",
      label: "Room",
      type: "Key",
      reftable: rooms,
      required: false,
      attributes: { summary_field: "name" },
    });
    await db.insert("messages", {
      content: "first message content for room A",
      user: 1,
      room: 1,
    });
    await db.insert("messages", {
      content: "second message content for room A",
      user: 1,
      room: 1,
    });

    const participants = await Table.create("participants", {
      min_role_read: 80,
      min_role_write: 80,
    });
    await Field.create({
      table: participants,
      name: "user",
      label: "User",
      type: "Key",
      reftable_name: "users",
      attributes: { summary_field: "email" },
      required: false,
    });
    await Field.create({
      table: participants,
      name: "room",
      label: "Room",
      type: "Key",
      reftable: rooms,
      required: false,
      attributes: { summary_field: "name" },
    });
    await View.create({
      table_id: participants.id,
      name: "participants_edit",
      viewtemplate: "Edit",
      configuration: {
        columns: [
          {
            type: "Field",
            field_name: "user",
            fieldview: "select",
            textStyle: "",
            block: false,
            configuration: {},
          },
          {
            type: "Field",
            field_name: "room",
            fieldview: "select",
            textStyle: "",
            block: false,
            configuration: {},
          },
        ],
      },
      min_role: 100,
    });
    await db.insert("participants", {
      user: 1,
      room: 1,
    });
    await db.insert("participants", {
      user: 2,
      room: 1,
    });
    await db.insert("participants", {
      user: 3,
      room: 1,
    });

    const roomsViewCfg = {
      exttable_name: null,
      viewname: "room",
      msg_relation: "messages.room",
      msgsender_field: "user",
      msgview: "show_message",
      msgform: "edit_message",
      participant_field: "participants.room.user",
      participant_maxread_field: "",
    };

    await View.create({
      table_id: rooms.id,
      name: "rooms_view",
      viewtemplate: "Room",
      configuration: roomsViewCfg,
      min_role: 80,
    });

    await View.create({
      table_id: rooms.id,
      name: "admin_rooms_view",
      viewtemplate: "Room",
      configuration: roomsViewCfg,
      min_role: 1,
    });

    await View.create({
      table_id: messages.id,
      name: "edit_message",
      viewtemplate: "Edit",
      configuration: {
        columns: [
          {
            type: "Field",
            field_name: "content",
            fieldview: "edit",
            textStyle: "",
            block: false,
            configuration: {},
          },
        ],
        layout: {
          above: [
            {
              type: "field",
              field_name: "content",
              fieldview: "edit",
              textStyle: "",
              block: false,
              configuration: {},
            },
          ],
        },
      },
      min_role: 80,
    });

    await View.create({
      table_id: messages.id,
      name: "show_message",
      viewtemplate: "Show",
      configuration: {
        columns: [
          { field_name: "content", type: "Field", fieldview: "as_text" },
        ],
        layout: {
          above: [
            {
              type: "field",
              block: false,
              fieldview: "as_text",
              textStyle: "",
              field_name: "content",
            },
          ],
        },
      },
      min_role: 80,
    });

    const topics = await Table.create("topics");
    await Field.create({
      table: topics,
      name: "name",
      label: "Name",
      type: "String",
      required: true,
    });
    await db.insert("topics", {
      name: "Topic A",
    });
    await db.insert("topics", {
      name: "Topic B",
    });
    await db.insert("topics", {
      name: "Topic C",
    });
    const uiit = await Table.create("user_interested_in_topic");
    await Field.create({
      table: uiit,
      name: "topic",
      label: "Topic",
      type: "Key",
      reftable: topics,
      required: false,
      attributes: { summary_field: "name" },
    });
    await Field.create({
      table: uiit,
      name: "user",
      label: "User",
      type: "Key",
      reftable_name: "users",
      required: false,
      attributes: { summary_field: "email" },
    });
    await db.insert("user_interested_in_topic", {
      topic: 1,
      user: 1,
    });
    await db.insert("user_interested_in_topic", {
      topic: 2,
      user: 2,
    });
    await db.insert("user_interested_in_topic", {
      topic: 1,
      user: 3,
    });
    await db.insert("user_interested_in_topic", {
      topic: 2,
      user: 3,
    });

    const bp = await Table.create("blog_posts");
    await Field.create({
      table: bp,
      name: "content",
      label: "Content",
      type: "String",
      required: true,
    });
    await Field.create({
      table: bp,
      name: "title",
      label: "Title",
      type: "String",
      required: true,
    });
    await db.insert("blog_posts", {
      content: "Content of post A",
      title: "Post A",
    });
    await db.insert("blog_posts", {
      content: "Content of post B",
      title: "Post B",
    });
    await db.insert("blog_posts", {
      content: "Content of post C",
      title: "Post C",
    });

    const bit = await Table.create("blog_in_topic");
    await Field.create({
      table: bit,
      name: "topic",
      label: "Topic",
      type: "Key",
      reftable: topics,
      required: true,
      attributes: { summary_field: "name" },
    });
    await Field.create({
      table: bit,
      name: "post",
      label: "Post",
      type: "Key",
      reftable: bp,
      required: true,
      attributes: { summary_field: "title" },
    });
    await db.insert("blog_in_topic", {
      topic: 1,
      post: 1,
    });
    await db.insert("blog_in_topic", {
      topic: 1,
      post: 2,
    });
    await db.insert("blog_in_topic", {
      topic: 1,
      post: 3,
    });
    await db.insert("blog_in_topic", {
      topic: 2,
      post: 2,
    });
    await db.insert("blog_in_topic", {
      topic: 3,
      post: 3,
    });

    const users = Table.findOne({ name: "users" });
    // blog_in_topic_feed in show user views
    await View.create({
      table_id: bit.id,
      name: "show_blog_in_topic",
      viewtemplate: "Show",
      configuration: {
        columns: [
          { type: "JoinField", join_field: "post.title" },
          { type: "JoinField", join_field: "topic.name" },
        ],
        layout: {
          above: [
            {
              type: "join_field",
              block: false,
              textStyle: "",
              join_field: "post.title",
            },
            {
              type: "join_field",
              block: false,
              textStyle: "",
              join_field: "topic.name",
            },
          ],
        },
      },
      min_role: 100,
    });

    await View.create({
      table_id: bit.id,
      name: "edit_blog_in_topic",
      viewtemplate: "Edit",
      configuration: {
        columns: [
          { type: "JoinField", join_field: "post.title" },
          { type: "JoinField", join_field: "topic.name" },
        ],
        layout: {
          above: [
            {
              type: "join_field",
              block: false,
              textStyle: "",
              join_field: "post.title",
            },
            {
              type: "join_field",
              block: false,
              textStyle: "",
              join_field: "topic.name",
            },
          ],
        },
      },
      min_role: 100,
    });

    await View.create({
      table_id: bit.id,
      name: "blog_in_topic_feed",
      viewtemplate: "Feed",
      configuration: {
        cols_lg: 1,
        cols_md: 1,
        cols_sm: 1,
        cols_xl: 1,
        in_card: false,
        viewname: "blog_in_topic_feed",
        show_view: "show_blog_in_topic",
        descending: false,
        view_to_create: "edit_blog_in_topic",
        create_view_display: "Link",
      },
      min_role: 100,
    });

    await View.create({
      table_id: users.id,
      name: "show_user_with_blog_in_topic_feed",
      viewtemplate: "Show",
      configuration: {
        columns: [],
        layout: {
          above: [
            {
              type: "view",
              view: "blog_in_topic_feed",
              relation:
                ".users.user_interested_in_topic$user.topic.blog_in_topic$topic",
              name: "fc3fc3",
              state: "shared",
            },
          ],
        },
      },
      min_role: 100,
    });

    // blog_post feed in show user views
    await View.create({
      table_id: bp.id,
      name: "show_blog_post",
      viewtemplate: "Show",
      configuration: {
        columns: [
          { field_name: "content", type: "Field", fieldview: "as_text" },
          { field_name: "title", type: "Field", fieldview: "as_text" },
        ],
        layout: {
          above: [
            {
              type: "field",
              block: false,
              fieldview: "as_text",
              textStyle: "",
              field_name: "content",
            },
            {
              type: "field",
              block: false,
              fieldview: "as_text",
              textStyle: "",
              field_name: "title",
            },
          ],
        },
      },
      min_role: 100,
    });

    await View.create({
      table_id: bp.id,
      name: "edit_blog_post",
      viewtemplate: "Edit",
      configuration: {
        columns: [
          {
            type: "Field",
            field_name: "content",
            fieldview: "edit",
          },
          {
            type: "Field",
            field_name: "title",
            fieldview: "edit",
          },
        ],
        layout: {
          above: [
            {
              type: "field",
              field_name: "content",
              fieldview: "edit",
              textStyle: "",
              block: false,
              configuration: {},
            },
            {
              type: "field",
              field_name: "title",
              fieldview: "edit",
              textStyle: "",
              block: false,
              configuration: {},
            },
          ],
        },
      },
      min_role: 100,
    });

    await View.create({
      table_id: bp.id,
      name: "blog_posts_feed",
      viewtemplate: "Feed",
      configuration: {
        cols_lg: 1,
        cols_md: 1,
        cols_sm: 1,
        cols_xl: 1,
        in_card: false,
        viewname: "blog_posts_feed",
        show_view: "show_blog_post",
        descending: false,
        view_to_create: "edit_blog_post",
        create_view_display: "Link",
      },
      min_role: 100,
    });

    await View.create({
      table_id: users.id,
      name: "show_user_with_blog_posts_feed",
      viewtemplate: "Show",
      configuration: {
        columns: [],
        layout: {
          above: [
            {
              type: "view",
              view: "blog_posts_feed",
              relation:
                ".users.user_interested_in_topic$user.topic.blog_in_topic$topic.post",
              name: "bc653",
              state: "shared",
            },
          ],
        },
      },
      min_role: 100,
    });

    await View.create({
      table_id: users.id,
      name: "show_user_with_independent_feed",
      viewtemplate: "Show",
      configuration: {
        columns: [],
        layout: {
          above: [
            {
              type: "view",
              view: "Independent:blog_posts_feed",
              name: "bc653",
              state: "shared",
            },
            {
              type: "view_link",
              view: "blog_posts_feed",
              relation: ".",
              view_label: "",
              block: false,
              minRole: 100,
              link_icon: "",
              isFormula: {},
            },
          ],
        },
      },
      min_role: 100,
    });

    const bpInbound = await Table.create("blog_post_inbound");
    await Field.create({
      table: bpInbound,
      name: "post",
      label: "Post",
      type: "Key",
      reftable: bp,
      attributes: { summary_field: "title" },
    });
    const inboundInbound = await Table.create("inbound_inbound");
    await Field.create({
      table: inboundInbound,
      name: "bp_inbound",
      label: "BP Inbound",
      type: "Key",
      reftable: bpInbound,
      attributes: { summary_field: "post" },
    });
    await Field.create({
      table: inboundInbound,
      name: "topic",
      label: "Topic",
      type: "Key",
      reftable: topics,
      attributes: { summary_field: "name" },
    });

    await db.insert("blog_post_inbound", {
      post: 1,
    });
    await db.insert("blog_post_inbound", {
      post: 3,
    });
    await db.insert("inbound_inbound", {
      bp_inbound: 1,
      topic: 1,
    });
    await db.insert("inbound_inbound", {
      bp_inbound: 2,
      topic: 1,
    });

    await View.create({
      table_id: users.id,
      name: "show_user_with_blog_posts_feed_two_levels",
      viewtemplate: "Show",
      configuration: {
        columns: [],
        layout: {
          above: [
            {
              type: "view",
              view: "blog_posts_feed",
              relation:
                ".users.user_interested_in_topic$user.topic.inbound_inbound$topic.bp_inbound.post",
              name: "bc653",
              state: "shared",
            },
          ],
        },
      },
      min_role: 100,
    });

    await Tag.create({
      name: "tag1",
      entries: [
        { table_id: table.id },
        { view_id: authorList.id },
        { view_id: authorShow.id },
        { view_id: authorEdit.id },
      ],
    });

    const mdl = await Model.create({
      name: "regression_model",
      table_id: table.id,
      modelpattern: "regression",
      configuration: { numcluster: 2 },
    });

    await ModelInstance.create({
      name: "regression_model_instance",
      model_id: mdl.id,
      fit_object: Buffer.from("foo"),
      hyperparameters: { numcluster: 2 },
      trained_on: new Date("2019-11-11T10:34:00.000Z"),
      is_default: false,
      metric_values: {},
      parameters: {},
      state: {},
      report: "report",
    });

    const artists = await Table.create("artists");
    const covers = await Table.create("covers");
    const albums = await Table.create("albums");
    const artistPlaysOnAlbum = await Table.create("artist_plays_on_album");
    const pressing_job = await Table.create("pressing_job");
    const fan_club = await Table.create("fan_club");
    const tracksOnAlbum = await Table.create("tracks_on_album");

    await Field.create({
      table: artists,
      name: "name",
      label: "Name",
      type: "String",
      required: true,
    });
    await Field.create({
      table: artists,
      name: "birth_data",
      label: "Birth data",
      type: "Date",
      required: true,
    });

    await Field.create({
      table: covers,
      name: "name",
      label: "Name",
      type: "String",
      required: true,
    });

    await Field.create({
      table: albums,
      name: "name",
      label: "Name",
      type: "String",
      required: true,
    });
    await Field.create({
      table: albums,
      name: "release_date",
      label: "Release date",
      type: "Date",
      required: true,
    });
    await Field.create({
      table: albums,
      name: "cover",
      reftable: covers,
      label: "Cover",
      type: "Key",
      is_unique: true,
      attributes: { summary_field: "name" },
    });

    await Field.create({
      table: artistPlaysOnAlbum,
      name: "artist",
      reftable: artists,
      label: "Artist",
      type: "Key",
      attributes: { summary_field: "name" },
    });
    await Field.create({
      table: artistPlaysOnAlbum,
      name: "album",
      reftable: albums,
      label: "Album",
      type: "Key",
      attributes: { summary_field: "name" },
    });

    await Field.create({
      table: tracksOnAlbum,
      name: "album",
      reftable: albums,
      label: "Album",
      type: "Key",
      attributes: { summary_field: "name" },
    });
    await Field.create({
      table: tracksOnAlbum,
      name: "track",
      label: "Name",
      type: "String",
      required: true,
    });

    await Field.create({
      table: pressing_job,
      name: "album",
      reftable: albums,
      label: "Album",
      type: "Key",
      attributes: { summary_field: "name" },
    });
    await Field.create({
      table: pressing_job,
      name: "pressing_date",
      label: "Pressing date",
      type: "Date",
      required: true,
    });

    await Field.create({
      table: fan_club,
      name: "name",
      label: "Name",
      type: "String",
      required: true,
    });
    await Field.create({
      table: fan_club,
      name: "artist",
      reftable: artists,
      label: "Artis",
      type: "Key",
      attributes: { summary_field: "name" },
    });

    await db.insert("artists", {
      name: "artist A",
      birth_data: new Date("2000-11-11T10:34:00.000Z"),
    });
    await db.insert("artists", {
      name: "artist B",
      birth_data: new Date("2000-11-11T10:34:00.000Z"),
    });
    await db.insert("albums", {
      name: "album A",
      release_date: new Date("2010-11-11T10:34:00.000Z"),
    });
    await db.insert("albums", {
      name: "album B",
      release_date: new Date("2010-11-11T10:34:00.000Z"),
    });
    await db.insert("artist_plays_on_album", {
      artist: 1,
      album: 1,
    });
    await db.insert("artist_plays_on_album", {
      artist: 1,
      album: 2,
    });
    await db.insert("artist_plays_on_album", {
      artist: 2,
      album: 1,
    });
    await db.insert("pressing_job", {
      album: 1,
      pressing_date: new Date("2010-11-11T10:34:00.000Z"),
    });
    await db.insert("pressing_job", {
      album: 2,
      pressing_date: new Date("2010-11-11T10:34:00.000Z"),
    });
    await db.insert("fan_club", {
      name: "crazy fan club",
      artist: 1,
    });
    await db.insert("fan_club", {
      name: "fan club",
      artist: 1,
    });
    await db.insert("fan_club", {
      name: "fan club official",
      artist: 1,
    });
    await db.insert("fan_club", {
      name: "another club",
      artist: 2,
    });

    await db.insert("tracks_on_album", {
      album: 1,
      track: "track one on album A",
    });
    await db.insert("tracks_on_album", {
      album: 2,
      track: "track one on album B",
    });

    await View.create({
      table_id: albums.id,
      name: "edit_album",
      viewtemplate: "Edit",
      configuration: {
        columns: [{ type: "Field", field_name: "name", state_field: "on" }],
        layout: {
          above: [{ type: "field", fieldview: "show", field_name: "name" }],
        },
      },
      min_role: 100,
    });
    await View.create({
      table_id: albums.id,
      name: "show_album",
      viewtemplate: "Show",
      configuration: {
        columns: [{ type: "Field", field_name: "name", state_field: "on" }],
        layout: {
          above: [{ type: "field", fieldview: "show", field_name: "name" }],
        },
      },
      min_role: 100,
    });

    await View.create({
      table_id: albums.id,
      name: "show_album_with_subview",
      viewtemplate: "Show",
      configuration: {
        columns: [{ type: "Field", field_name: "name", state_field: "on" }],
        layout: {
          above: [
            { type: "field", fieldview: "show", field_name: "name" },
            {
              name: "d7603a",
              type: "view",
              view: "Own:show_album",
              state: "shared",
              configuration: {},
            },
          ],
        },
      },
      min_role: 100,
    });

    await View.create({
      table_id: albums.id,
      name: "show_album_with_subview_new_relation_path",
      viewtemplate: "Show",
      configuration: {
        columns: [],
        layout: {
          above: [
            {
              name: "d7603a",
              type: "view",
              view: "show_album",
              state: "shared",
              relation: ".albums",
              configuration: {},
            },
          ],
        },
      },
      min_role: 100,
    });

    await View.create({
      table_id: albums.id,
      name: "albums_feed",
      viewtemplate: "Feed",
      configuration: {
        cols_lg: 1,
        cols_md: 1,
        cols_sm: 1,
        cols_xl: 1,
        in_card: false,
        viewname: "albums_feed",
        show_view: "edit_album",
        descending: false,
        view_to_create: "edit_album",
        create_view_display: "Link",
      },
      min_role: 100,
    });

    await View.create({
      table_id: tracksOnAlbum.id,
      name: "edit_tracks_on_album",
      viewtemplate: "Edit",
      configuration: {
        columns: [{ type: "Field", field_name: "album", state_field: "on" }],
        layout: {
          above: [{ type: "field", fieldview: "show", field_name: "album" }],
        },
      },
      min_role: 100,
    });

    await View.create({
      table_id: tracksOnAlbum.id,
      name: "tracks_on_album_feed",
      viewtemplate: "Feed",
      configuration: {
        cols_lg: 1,
        cols_md: 1,
        cols_sm: 1,
        cols_xl: 1,
        in_card: false,
        viewname: "tracks_on_album_feed",
        show_view: "edit_tracks_on_album",
        descending: false,
        view_to_create: "edit_tracks_on_album",
        create_view_display: "Link",
      },
      min_role: 100,
    });

    await View.create({
      table_id: artists.id,
      name: "show_artist",
      viewtemplate: "Show",
      configuration: {
        columns: [{ type: "Field", field_name: "name", state_field: "on" }],
        layout: {
          above: [
            { type: "field", fieldview: "show", field_name: "name" },
            {
              name: "d7603a",
              type: "view",
              view: "albums_feed",
              state: "shared",
              relation: ".artists.artist_plays_on_album$artist.album",
              configuration: {},
            },
          ],
        },
      },
      min_role: 100,
    });

    await View.create({
      table_id: artistPlaysOnAlbum.id,
      name: "artist_plays_on_album_list",
      viewtemplate: "List",
      configuration: {
        columns: [
          { type: "Field", field_name: "artist", state_field: "on" },
          { type: "Field", field_name: "album", state_field: "on" },
        ],
      },
      min_role: 100,
    });

    await View.create({
      table_id: fan_club.id,
      name: "edit_fan_club",
      viewtemplate: "Edit",
      configuration: {
        columns: [{ type: "Field", field_name: "name", state_field: "on" }],
        layout: {
          above: [{ type: "field", fieldview: "show", field_name: "name" }],
        },
      },
      min_role: 100,
    });
    await View.create({
      table_id: fan_club.id,
      name: "show_fan_club",
      viewtemplate: "Show",
      configuration: {
        columns: [{ type: "Field", field_name: "name", state_field: "on" }],
        layout: {
          above: [{ type: "field", fieldview: "show", field_name: "name" }],
        },
      },
      min_role: 100,
    });
    await View.create({
      table_id: fan_club.id,
      name: "fan_club_feed",
      viewtemplate: "Feed",
      configuration: {
        cols_lg: 1,
        cols_md: 1,
        cols_sm: 1,
        cols_xl: 1,
        in_card: false,
        viewname: "fan_club_feed",
        show_view: "edit_fan_club",
        descending: false,
        view_to_create: "edit_fan_club",
        create_view_display: "Link",
      },
      min_role: 100,
    });

    await View.create({
      table_id: pressing_job.id,
      name: "show_pressing_job",
      viewtemplate: "Show",
      configuration: {
        columns: [{ type: "Field", field_name: "name", state_field: "on" }],
        layout: {
          above: [
            { type: "field", fieldview: "show", field_name: "name" },
            {
              name: "d7603a",
              type: "view",
              view: "Independent:fan_club_feed",
              state: "shared",
              relation: undefined,
              configuration: {},
            },
          ],
        },
      },
      min_role: 100,
    });

    await View.create({
      table_id: pressing_job.id,
      name: "show_pressing_job_with_new_indenpendent_relation_path",
      viewtemplate: "Show",
      configuration: {
        columns: [{ type: "Field", field_name: "name", state_field: "on" }],
        layout: {
          above: [
            { type: "field", fieldview: "show", field_name: "name" },
            {
              name: "a7603e",
              type: "view",
              view: "fan_club_feed",
              relation: ".",
              state: "shared",
              configuration: {},
            },
          ],
        },
      },
      min_role: 100,
    });

    const department = await Table.create("department");
    const employee = await Table.create("employee");
    const company = await Table.create("company");
    await Field.create({
      table: company,
      name: "name",
      label: "Name",
      type: "String",
      required: true,
    });

    await Field.create({
      table: department,
      name: "company",
      reftable: company,
      label: "Company",
      type: "Key",
      attributes: { summary_field: "name" },
    });
    await Field.create({
      table: department,
      name: "manager",
      reftable: employee,
      label: "Manager",
      type: "Key",
      is_unique: true,
      attributes: { summary_field: "name" },
    });
    await Field.create({
      table: department,
      name: "name",
      label: "Name",
      type: "String",
      required: true,
    });

    await Field.create({
      table: employee,
      name: "name",
      label: "Name",
      type: "String",
      required: true,
    });
    await Field.create({
      table: employee,
      name: "department",
      reftable: department,
      label: "Department",
      type: "Key",
      attributes: { summary_field: "name" },
    });

    await db.insert("company", {
      name: "my_company",
    });

    await db.insert("department", {
      name: "my_department",
      company: 1,
    });
    await db.insert("employee", {
      name: "manager",
      department: 1,
    });
    await db.insert("employee", {
      name: "my_employee",
      department: 1,
    });
    await db.update(
      "department",
      {
        manager: 1,
      },
      1
    );

    await View.create({
      table_id: employee.id,
      name: "show_manager",
      viewtemplate: "Show",
      configuration: {
        columns: [{ type: "Field", field_name: "name", state_field: "on" }],
        layout: {
          above: [{ type: "field", fieldview: "show", field_name: "name" }],
        },
      },
      min_role: 100,
    });

    await View.create({
      table_id: employee.id,
      name: "show_employee",
      viewtemplate: "Show",
      configuration: {
        columns: [{ type: "Field", field_name: "name", state_field: "on" }],
        layout: {
          above: [
            { type: "field", fieldview: "show", field_name: "name" },
            {
              type: "view",
              view: "show_manager",
              relation: ".employee.department.manager",
              name: "bc653",
              state: "shared",
            },
          ],
        },
      },
      min_role: 100,
    });
  };
