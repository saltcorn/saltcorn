import { JOB_ID_RE, getRestoreJobStatus } from "../auth/restore_jobs.js";

describe("JOB_ID_RE", () => {
  it("accepts a uuid v4 shaped job id", () => {
    expect(JOB_ID_RE.test("3fa85f64-5717-4562-b3fc-2c963f66afa6")).toBe(true);
  });
  it("rejects path traversal payloads", () => {
    expect(JOB_ID_RE.test("../../../etc/passwd")).toBe(false);
    expect(JOB_ID_RE.test("../../../../etc/passwd")).toBe(false);
    expect(JOB_ID_RE.test("foo/bar")).toBe(false);
    expect(JOB_ID_RE.test("..%2f..%2fetc%2fpasswd")).toBe(false);
  });
  it("rejects the wrong length or an empty string", () => {
    expect(JOB_ID_RE.test("")).toBe(false);
    expect(JOB_ID_RE.test("abc")).toBe(false);
  });
});

describe("getRestoreJobStatus", () => {
  it("returns null for a path traversal payload instead of touching disk", () => {
    expect(getRestoreJobStatus("../../../../etc/passwd")).toBe(null);
  });
  it("returns null for an unknown but well-shaped job id", () => {
    expect(getRestoreJobStatus("00000000-0000-0000-0000-000000000000")).toBe(
      null
    );
  });
});
