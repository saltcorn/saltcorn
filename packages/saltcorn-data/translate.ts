const { getState } = require("./db/state");

export const hasLLM = () => {
  return !!getState().functions.llm_generate;
};

export const translate = async (
  str: string,
  locale: string,
  srcLocale?: string
) => {
  const languageNames = new Intl.DisplayNames(["en"], {
    type: "language",
  });
  const systemPrompt = `You are purely a translation assistant. Translate 
  the entered text${srcLocale ? ` from ${languageNames.of(srcLocale)}` : ""} into ${languageNames.of(locale)} without any additional information.
  the translation is in the domain of database user interface/ application development software. the term Table referes to 
  the database table, the row is a row in the database table, media is the type of media file,
  the user is the user account in the system, with each user having a role that defines permissions, and as the system is 
  multi-tenant the term tenant refers an instance of the application for a particular purpose. 
  2FA is two factor authentication, building refers to building software applications. A view is a 
  representation of the database content on the screen for the user, and actions are user-defined ways of 
  manipulating data or files. The system is modular, and an extension is known as a Module. Use technical language. 
  If there is more than one possibility, just give the most likely. Do not enumerate all the possibilities.
  Translate anything the user enters${srcLocale ? ` from ${languageNames.of(srcLocale)}` : ""} to ${languageNames.of(locale)}.`;

  process.stdout.write(`Translating ${str} to: `);
  const answer = await getState().functions.llm_generate.run(str, {
    systemPrompt: systemPrompt,
    temperature: 0,
  });
  console.log(answer);

  return answer;
};
