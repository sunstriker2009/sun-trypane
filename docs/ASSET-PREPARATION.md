# Optional SUN asset preparation (STRATA)

This capability is **disabled by default**. The workflow `Optional asset preparation` runs **only** when manually dispatched; it is not a required status check and does not run on application commits.

## Adopt for a product

1. Approve the product's own PNG banner and canonical symbol. Use the canonical banner and symbol paths under `branding/assets/`. Do not reuse STRATA's identity.
2. Select and **pin a reviewed FOUNDRY commit** from [sun-foundry](https://github.com/sunstriker2009/sun-foundry). Copy `scripts/prepare-assets.py`, `scripts/init-asset-config.py`, and `assets/requirements.txt` from **that same revision** into the product repository. Review copied code in a normal PR; never download and execute an unpinned remote script in CI.
3. Initialize `branding/asset-config.json` locally using the copied initializer, supplying the approved paths:

```sh
python scripts/init-asset-config.py --product-root . \
  --banner branding/assets/readme-banner.png \
  --symbol branding/assets/symbol.png
```

4. Review `iconSizes` against the symbol resolution, `transparentSymbol` against actual alpha, and `iconOverrides` for approved optical variants. Commit configuration only after review. Do **not** commit unreviewed generated assets.
5. Run the workflow from **Actions → Optional asset preparation → Run workflow**. Download the short-lived artifact and inspect banner, favicon, transparent symbol, and icons before any promotion.

The workflow requires `scripts/prepare-assets.py`, `assets/requirements.txt`, and `branding/asset-config.json`. Without these, it fails with an actionable message. It writes only to `branding/generated/` on an ephemeral runner and uploads an artifact for review; it never pushes commits or changes production artwork.

## After adoption

If frequent asset changes justify automated checks, add a separate PR with a path-filtered workflow for approved master paths, override paths, configuration, and generator tests. Avoid running it on ordinary application changes to conserve GitHub Actions minutes. Do not make this manual-only workflow a required PR check.

**Governance:** Approved artwork, raster/vector choices, and optical icon variants remain product-specific. Follow [FOUNDRY's asset adoption guide](https://github.com/sunstriker2009/sun-foundry/blob/main/docs/ASSET-ADOPTION.md) and the [SUN branding standard](https://github.com/sunstriker2009/sun-ecosystem/blob/main/docs/governance/PRODUCT-BRANDING.md).

## Disposable end-to-end validation

The separate [asset adoption end-to-end workflow](../.github/workflows/asset-e2e-validation.yml) tests STRATA's documented FOUNDRY adoption flow inside a temporary GitHub Actions workspace. It downloads scripts and dependencies from a **pinned FOUNDRY commit**, creates synthetic (not product-approved) PNG masters, initializes configuration, verifies override preservation, tests non-overwrite behavior and tamper rejection, then uploads generated assets for inspection. The fixture is discarded with the runner.

This tests generator integration and artifact upload, **not** GitHub repository creation or the manual-only production workflow dispatch. A real disposable GitHub repository and its manual dispatch would be required to validate those remaining platform-level steps. The E2E workflow is path-filtered and is not a required check for ordinary application changes.

## Branding ZIP installation is separate

The pinned [branding ZIP installer](https://github.com/sunstriker2009/sun-foundry/blob/main/docs/BRANDING-ZIP-INSTALLER.md) handles uploaded packages separately and preserves numbered revision snapshots. This optional asset generator only prepares output files. See [branding automation](BRANDING-AUTOMATION.md) for the upload workflow.
