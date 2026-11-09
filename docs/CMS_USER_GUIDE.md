# Nomaan Brothers — Staff CMS User Guide (Catalogue-First)

**Who uses this:** store owner, managers and approved editors. The website is a catalogue and WhatsApp/showroom enquiry site; it is not a POS, inventory system, order processor or payment gateway.

## Access

1. Open the client-approved domain and add `/studio`.
2. Sign in with the staff email and password provisioned by the owner via Supabase Auth.
3. Roles: **editor** prepares product/homepage drafts and uploads pending media; **admin/owner** reviews media and publishes approved content. The owner creates or revokes staff access.
4. If access is denied, ask the owner to verify the staff role; never share passwords or use the old demo PIN.

## Add a product (few products at a time)

1. Open **Products > New product**.
2. Select **Men’s/Kids’ Wear**, then a garment category before anything else. Supabase reserves the permanent read-only SKU (e.g. `NB-SH-00001` for Sherwani or `NB-SU-00001` for Suits). Then enter name, fabric, sizes, description and optional price. The UUID primary key remains unique too; no stock counts are tracked.
3. Simplest: drag authorized photos directly into the product. Owner/admin uploads are approved by the protected Edge Function and attached automatically. Alternatively upload into the Media library; pending files stay private until reviewed.
4. Choose cover and gallery order (first image is cover), optionally select an approved video. Use **Choose/replace** for previously uploaded library files.
5. Click **Save private draft**. Verify the public site remains unchanged.
6. Owner/admin publishes the first version. For a published garment, search by name or SKU, click **Edit published product**, change price/text/photos/category, then **Update published product**. Its SKU stays unchanged; old published versions stay in revision history. Archive removes an item from the public site without deleting its history.

## Bulk catalogue CSV

- Go to **Bulk imports** and choose a CSV up to 8 MB with at most 10,000 rows. Start with the file `templates/products.csv`.
- Required columns: `title,department,category`; optional: `sku,sizes,fabric,description,price`. Leave SKU blank for automatic serial allocation and download the resulting SKU mapping CSV.
- Department must be `men` or `kids`; category must be a valid full category path such as `/men/sherwani`. Sizes are separated by `|` (e.g. `38|40|42`).
- Review the **valid/invalid** count before import. Existing SKUs are skipped, not overwritten. Rows are stored as private drafts; there is **no automatic mass publication**.
- If interrupted, run the same file again. The import fingerprint resumes previously recorded rows. Avoid running the same import concurrently from two staff sessions.
- Download the failed-row CSV when needed, correct the original file and reimport with care (a revised file has a new fingerprint).

## Bulk photographs and SKU matching

1. Choose Men’s/Kids’ and required category for each photo batch. If the files belong to **one** product, paste its SKU, e.g. `NB-SH-00001`, and the app renames camera pictures automatically to `NB-SH-00001_01.jpg`, `NB-SH-00001_02.jpg`. For mixed-product batches, pre-rename files as SKU_01.jpg before upload.
2. Select at most **250 images per batch** in Bulk imports. Accepted images: JPEG, PNG, WebP, AVIF, GIF. 50 MB maximum per file; use smaller optimized files for real customer performance.
3. Files upload to private staging first. Owner/admin reviews and approves in Media library.
4. Open **Bulk imports > Match approved images by SKU** to attach approved photos to product drafts that currently have **empty galleries**. Manual galleries are preserved. Matching processes bounded batches and may require another click to finish.
5. Open a sample of the matched products, verify cover order, sizes and captions, and publish individually through the authorized workflow.

## Homepage and collections

- **Homepage** edits are drafts until owner/admin explicitly publishes a new version.
- **Collections** controls approved category descriptions and banners. Do not rename/change category routes without coordinating website routing.
- Verify all contact numbers, displayed claims, brand wording and gallery rights with the owner.
- Category/public edits can become visible immediately where stated; check before saving.

## Safeguards and support

- Never upload private client documents, customer data, passwords or copyrighted images without permission.
- If a file fails after the Storage upload but before metadata insertion, **do not repeatedly upload blindly**; record the filename/job and ask AGM to reconcile orphan storage objects.
- If an approved image is revoked, verify no published product depends on it; asset removal and CDN caches may require coordinated cleanup.
- Verify product display on a phone after publishing. If an unauthorized person gets access, the owner revokes their Supabase Auth session/role and requests review of any suspicious recent changes.
- Keep product SKUs stable. The future ERP/POS can use these same SKU references without the catalogue claiming live stock.
