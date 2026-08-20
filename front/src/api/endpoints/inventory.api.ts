import api from "../axios";
import type { Inventory, SetMinLevelDto, BulkStockInDto } from "../../types/inventory.types";
export const inventoryApi = {
  getAll: (params?: { organizationId?: string }) =>
    api.get<Inventory[]>("/inventory", { params }).then((r) => r.data),
  getAssignedAssets: (params?: { organizationId?: string }) =>
    api.get<any[]>("/inventory/assigned-assets", { params }).then((r) => r.data),
  getOne: (productId: string) =>
    api.get<Inventory>(`/inventory/${productId}`).then((r) => r.data),
  getLowStock: () =>
    api.get<Inventory[]>("/inventory/low-stock").then((r) => r.data),
  setMinLevel: (dto: SetMinLevelDto) =>
    api.patch("/inventory/min-level", dto).then((r) => r.data),
  bulkStockIn: (dto: BulkStockInDto) =>
    api.post("/inventory/bulk-stock-in", dto).then((r) => r.data),
  importExcel: (file: File, productType?: string) => {
    const formData = new FormData();
    formData.append("file", file);
    if (productType) {
      formData.append("productType", productType);
      formData.append("type", productType);
      formData.append("product_type", productType);
      formData.append("isConsumable", productType === "SARFLANADIGAN" ? "true" : "false");
    }
    return api
      .post("/inventory/import-excel", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },
  importMasterExcel: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api
      .post("/inventory/master-import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },
  downloadMasterTemplate: async () => {
    const blob = (await api.get("/inventory/master-template", {
      responseType: "blob",
    })) as unknown as Blob;
    const finalBlob = blob instanceof Blob ? blob : new Blob([blob], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = window.URL.createObjectURL(finalBlob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "Master_Barcha_Malumotlar_Shabloni.xlsx");
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
  exportCsv: async (organizationId?: string) => {
    const params = organizationId ? { organizationId } : {};
    const blob = (await api.get("/inventory/export", {
      params,
      responseType: "blob",
    })) as unknown as Blob;
    const finalBlob =
      blob instanceof Blob
        ? blob
        : new Blob([blob], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(finalBlob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `ombor_hisoboti_${organizationId || "export"}_${Date.now()}.csv`
    );
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};