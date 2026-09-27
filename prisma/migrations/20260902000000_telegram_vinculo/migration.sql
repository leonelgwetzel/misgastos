-- CreateTable
CREATE TABLE "TelegramVinculo" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "chatId" BIGINT,
    "alias" TEXT,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "vinculadoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramVinculo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramVinculo_codigo_key" ON "TelegramVinculo"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramVinculo_chatId_key" ON "TelegramVinculo"("chatId");

-- CreateIndex
CREATE INDEX "TelegramVinculo_usuarioId_idx" ON "TelegramVinculo"("usuarioId");

-- AddForeignKey
ALTER TABLE "TelegramVinculo" ADD CONSTRAINT "TelegramVinculo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
