-- CreateTable
CREATE TABLE "AppInstallation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "accessToken" TEXT,
    "scope" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "AppInstallation_shop_key" ON "AppInstallation"("shop");
