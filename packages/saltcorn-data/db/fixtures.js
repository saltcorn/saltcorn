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
    await View.create({
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
    await View.create({
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
    await View.create({
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
  };
