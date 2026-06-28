// Mobile mock for models/email. Email delivery and MJML/prettier rendering are
// server-only and pull heavy dependencies, so they are excluded from the mobile
// bundle. The named exports below mirror the real module's surface (webpack
// statically validates ESM named imports) with runtime-safe no-ops — none of
// these are reached while rendering views on mobile.

export const getMailTransport = (): any => null;

export const send_verification_email = async (
  _user?: any,
  _req?: any,
  _opts?: any
): Promise<boolean> => false;

export const viewToEmailHtml = async (
  _view?: any,
  _state?: any,
  _opts?: any
): Promise<string> => "";

export const getFileAggregations = (_fields?: any): Record<string, any> => ({});

export const loadAttachments = async (
  _fileFields?: any,
  _row?: any,
  _user?: any
): Promise<any[]> => [];

export const mjml2html = (_mjmlMarkup?: string, _opts?: any): any => ({
  html: "",
  errors: [],
});
