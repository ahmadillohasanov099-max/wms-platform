import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { productsApi } from "../../api";
import Modal from "../../components/ui/modal";
import { TableSkeleton } from "../../components/ui/spinner";
import { ProductTypeBadge } from "../../components/ui/badge";
import CopyableInventoryNumber from "../../components/ui/copyable-inventory-number";
import { formatCurrency } from "../../lib/utils";

import { ShieldCheck, User, Building2, History, Edit2, PackageCheck } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  productId: string | null;
  onOpenHistory?: (product: any) => void;
  onOpenEdit?: (product: any) => void;
  disableLinks?: boolean;
}

export default function ProductDetailModal({ open, onClose, productId, onOpenHistory, onOpenEdit, disableLinks }: Props) {
  const navigate = useNavigate();
  const { data: product, isLoading } = useQuery({
    queryKey: ["product-detail", productId],
    queryFn: () => (productId ? productsApi.getOne(productId) : null),
    enabled: !!productId && open,
    staleTime: 0,
  });

  if (!open) return null;

  const assets = product?.assets || [];
  const inventory = product?.inventory;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product ? product.name : "Mahsulot Tafsilotlari"}
      size="xl"
    >
      {isLoading ? (
        <TableSkeleton rows={5} cols={4} />
      ) : !product ? (
        <div className="py-8 text-center text-sm text-gray-500">Mahsulot topilmadi</div>
      ) : (
        <div className="space-y-5">
          {}
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
              <PackageCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                {product.name}
              </h3>
              <p className="text-2xs text-gray-400">
                {product.unit ? `O'lchov birligi: ${product.unit}` : 'Mahsulot ma’lumotlari'}
              </p>
            </div>
          </div>
          {}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50/60 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-gray-500 font-medium">Turi:</span>
              <ProductTypeBadge type={product.productType} />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 font-medium">Omborda:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {inventory?.quantity || 0} {product.unit?.toLowerCase() || 'dona'}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 font-medium">Birlik narxi:</span>
              <span className="font-bold font-mono text-slate-900 dark:text-slate-100">
                {inventory?.unitPrice ? formatCurrency(Number(inventory.unitPrice)) : "—"}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 font-medium">Jami qiymati:</span>
              <span className="font-bold font-mono text-teal-600 dark:text-teal-400">
                {(() => {
                  const qty = Number(inventory?.quantity || 0);
                  const uPrice = Number(inventory?.unitPrice || 0);
                  const tot = inventory?.totalValue ? Number(inventory.totalValue) : qty * uPrice;
                  return tot > 0 ? formatCurrency(tot) : "—";
                })()}
              </span>
            </div>
          </div>

          {}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Inventar Raqamli Jihozlar ({assets.length} dona)
              </h4>
            </div>

            {assets.length === 0 ? (
              <div className="bg-slate-50/60 dark:bg-slate-800/30 rounded-2xl p-6 text-center text-xs text-slate-500 border border-slate-200/70 dark:border-slate-800">
                Ushbu mahsulot uchun alohida inventar raqamli jihozlar kiritilmagan yoki u sarflanadigan materialdir.
              </div>
            ) : (
              <div className="border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-100/70 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                      <th className="px-3.5 py-2.5 text-left font-bold">№</th>
                      <th className="px-3.5 py-2.5 text-left font-bold">
                        Inventar Raqami (Инвентарный №)
                      </th>
                      <th className="px-3.5 py-2.5 text-left font-bold">
                        Narxi
                      </th>
                      <th className="px-3.5 py-2.5 text-left font-bold">
                        Hozirgi Holati / Egasi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {assets.map((asset: any, idx: number) => {
                      const activeAssignment = asset.assignments?.find((a: any) => !a.returnedAt);
                      const isWrittenOff = asset.status === 'WRITTEN_OFF';
                      const isBroken = asset.status === 'BROKEN';
                      const isLost = asset.status === 'LOST';

                      return (
                        <tr key={asset.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-3.5 py-2.5 text-slate-400 font-mono">{idx + 1}</td>
                          <td className="px-3.5 py-2.5">
                            <CopyableInventoryNumber value={asset.inventoryNumber} />
                          </td>

                          <td className="px-3.5 py-2.5 font-mono text-slate-700 dark:text-slate-300">
                            {asset.purchasePrice ? formatCurrency(Number(asset.purchasePrice)) : "—"}
                          </td>
                          <td className="px-3.5 py-2.5">
                            {isWrittenOff ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/70 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900/50">
                                🔴 Hisobdan chiqarilgan
                              </span>
                            ) : isBroken ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/70 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900/50">
                                ⚠️ Nosoz / Ta'mirda
                              </span>
                            ) : isLost ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-orange-50 text-orange-700 border border-orange-200/70 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-900/50">
                                ❓ Yo'qolgan
                              </span>
                            ) : activeAssignment ? (
                              activeAssignment.user ? (
                                disableLinks ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-2xs font-bold bg-blue-50 text-blue-700 border border-blue-200/70 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900/50">
                                    <User className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                    Xodimda: {activeAssignment.user.fullName}
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onClose();
                                      navigate(`/users/${activeAssignment.user.id}`);
                                    }}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-2xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/70 dark:bg-blue-950/60 dark:hover:bg-blue-900 dark:text-blue-300 dark:border-blue-900/50 transition-all hover:scale-105 cursor-pointer"
                                    title={`${activeAssignment.user.fullName} profiliga o'tish`}
                                  >
                                    <User className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                    Xodimda: {activeAssignment.user.fullName} ↗
                                  </button>
                                )
                              ) : activeAssignment.department ? (
                                disableLinks ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-2xs font-bold bg-purple-50 text-purple-700 border border-purple-200/70 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-900/50">
                                    <Building2 className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                                    Bo'limda: {activeAssignment.department.name}
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onClose();
                                      navigate(`/departments/${activeAssignment.department.id}`);
                                    }}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-2xs font-bold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200/70 dark:bg-purple-950/60 dark:hover:bg-purple-900 dark:text-purple-300 dark:border-purple-900/50 transition-all hover:scale-105 cursor-pointer"
                                    title={`${activeAssignment.department.name} bo'limiga o'tish`}
                                  >
                                    <Building2 className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                                    Bo'limda: {activeAssignment.department.name} ↗
                                  </button>
                                )
                              ) : (
                                <span className="text-slate-400">—</span>
                              )
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900/50">
                                🟢 Omborda bo'sh
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              {onOpenHistory && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenHistory(product);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 rounded-xl transition-all"
                >
                  <History className="w-3.5 h-3.5" />
                  Harakatlar tarixi
                </button>
              )}
              {onOpenEdit && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenEdit(product);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 rounded-xl transition-all"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Tahrirlash
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
            >
              Yopish
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
