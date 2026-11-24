# Using STRATA by Sun

1. On GitHub, open `sunstriker2009/sun-strata`.
2. The source is already a template repository as checked for this handoff. If using a fork or replacement source, verify its template setting first.
3. Select **Use this template → Create a new repository**.
4. Choose a product repository name and visibility.
5. Follow `docs/REPOSITORY-SETUP.md` in the generated repository. Replace the inherited STRATA artwork and set the new product’s metadata in `branding/manifest.json`.
6. Run the initial CI, then configure required checks and protected main.
7. Use PRs and squash merges for subsequent changes.

STRATA is intentionally stack-agnostic; it does not compile .NET or Next.js projects. It only provides baseline repository checks and governance scaffolding.

Optional product branding preparation is described in [ASSET-PREPARATION.md](ASSET-PREPARATION.md). It is not enabled automatically and does not substitute for owner approval.
