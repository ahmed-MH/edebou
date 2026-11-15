import "server-only";

import { prismaCatalogRepository } from "@/lib/repositories/prisma-catalog-repository";

import { CatalogService } from "./catalog-service";

export const catalogService = new CatalogService(prismaCatalogRepository);

export { CatalogService } from "./catalog-service";
