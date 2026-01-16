# Security Policy

1. [No warrenty](#no-warrenty)
2. [Risks](#risks)
3. [Known issues](#known-issues)
4. [Disclosing new vulnerabilities](#disclosing-new-vulnerabilities)

## No warrenty

Saltcorn is released under the MIT license, which includes the following clause:

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

Please read the [license](https://github.com/saltcorn/saltcorn/blob/master/LICENSE) in full before using Saltcorn.

Nothing in this document or in any other document or communication provided by the
Saltcorn developers should be construed as an implicit warranty or guarantee of
fitness for any particular purpose. Nor should anything we say be construed as an
implicit promise, warrenty or guarantee that Saltcorn has been created with an adequate
development methodology, or by individuals with suitable professional
qualifications, for any particular purpose.

## Risks

Admin users have full control over the server. You should not give admin rights to any user you do not fully trust. Anyone with administrator privileges has the ability to insert security vulnerabilities into your application. Text entered by admin is not escaped for cross-site scripting vulnerabilities. 

By operating Saltcorn with open tenant creation (minimum role to create tenant=public) or giving tenant admin rights to untrusted parties you are exposing the server and all the data on it (including other and root tenants) to full system takeover. There an ongoing effort to limit what subdomain tenant admins can do but this is work in progess.

Saltcorn is developed and deployed based on the nodejs and npm ecosystem. We may be vulnerable to open source supply chain attacks and in addition there are many libraries with low quality and a low level of security scrutiny.

There is [some debate](https://github.com/birdofpreyru/csurf/issues/1) about the library we use for CSRF protection ([@dr.pogodin/csurf](https://www.npmjs.com/package/@dr.pogodin/csurf)).

Many other libraries we depend on are deprecated or have security warnings. We have no reason to believe any of these are exploitable but we could be wrong.

You should review the way cookies and sessions are handled and the HTTP headers set. We have disabled some protective measures to allow certain authentication methods.

Our code to use SQLite has not received the same degree of scrutiny as that using PostgreSQL as a backend. We recommend using PostgreSQL as a backend for production purposes and only using SQLite for development in desktop environments.

The windows environment has not received the same amount of scrutiny as deployment options on Linux. We recommend using Linux or another Unix-based system for production deployment. Windows deployments are also likely to be less stable. If you must deploy on Windows we recommend using WSL.

Modules are not sandboxed. A module can run any code and cause a full system takeover if it contains malicious code.

## Known issues

The implmentation of ownership formulas in Filter aggregations (which are used to show counts, averages etc) is incomplete. For complex ownership formulas, in particular those that include join fields, aggregations may include rows that the user does not have access to.

In List, Show and Edit views, rows in different tables accessed as join fields and aggregations may not check for ownership.

There are known ways for subdomain tenant admins to execute remote shell code.

## Disclosing new vulnerabilities

If you have discovered a security vulnerability in this project, please report it
privately. **Do not disclose it as a public issue.** This gives us time to work with you
to fix the issue before public exposure, reducing the chance that the exploit will be
used before a patch is released.

You may submit the report in the following ways:

- send an email to security@saltcorn.com; and/or
- send us a [private vulnerability report](https://github.com/saltcorn/saltcorn/security/advisories/new)

Please provide the following information in your report:

- A description of the vulnerability and its impact
- How to reproduce the issue

You are welcome to submit security vulnerabilities that require administrative privileges to exploit. We will accept these if valid and treat as high priority bugs. We will not issue CVEs or use confidential development facilities to fix security vulnerabilities that require administrative privileges.
