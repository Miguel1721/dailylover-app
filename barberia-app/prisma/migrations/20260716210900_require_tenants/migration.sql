-- AlterTable
ALTER TABLE "users" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "barbers" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "services" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "products" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "appointments" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "sales" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "commissions" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "expenses" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "expense_categories" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "settings" ALTER COLUMN "tenantId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "settings_tenantId_key" ON "settings"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_name_tenantId_key" ON "expense_categories"("name", "tenantId");
