-- CreateTable
CREATE TABLE "ShopSetting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "defaultFormat" TEXT NOT NULL DEFAULT '100x150',
    "defaultTemplate" TEXT NOT NULL DEFAULT 'minimal',
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopSetting_shop_key" ON "ShopSetting"("shop");
