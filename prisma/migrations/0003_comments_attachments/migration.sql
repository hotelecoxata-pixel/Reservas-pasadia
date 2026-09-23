-- CreateTable
CREATE TABLE "reservation_comments" (
    "id" TEXT NOT NULL,
    "reservation_id" TEXT NOT NULL,
    "author_id" TEXT,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservation_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation_attachments" (
    "id" TEXT NOT NULL,
    "reservation_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "uploaded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservation_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reservation_comments_reservation_id_created_at_idx" ON "reservation_comments"("reservation_id" ASC, "created_at" ASC);

-- CreateIndex
CREATE INDEX "reservation_attachments_reservation_id_idx" ON "reservation_attachments"("reservation_id" ASC);

-- AddForeignKey
ALTER TABLE "reservation_comments" ADD CONSTRAINT "reservation_comments_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_comments" ADD CONSTRAINT "reservation_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_attachments" ADD CONSTRAINT "reservation_attachments_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_attachments" ADD CONSTRAINT "reservation_attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
