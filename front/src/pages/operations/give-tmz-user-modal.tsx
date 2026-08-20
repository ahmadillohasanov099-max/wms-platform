import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { operationsApi, usersApi, productsApi, inventoryApi } from "../../api";
import Modal from "../../components/ui/modal";
import Input from "../../components/ui/input";
import Button from "../../components/ui/button";
import TalabnomaModal, {
  type TalabnomaData,
} from "../../components/documents/talabnoma-modal";
import { useAuthStore } from "../../store/auth.store";
import { invalidateAppQueries } from "../../lib/utils";
import { useTranslation } from "../../hooks/useTranslation";
import {
  Plus,
  Trash2,
  Search,
  UserCheck,
  Package,
  X,
  Loader2,
} from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface ProductRow {
  rowId: string;
  productId: string;
  productName: string;
  unit: string;
  availableQty: number;
  quantity: number;
  searchInput: string;
}

export default function GiveTmzUserModal({ open, onClose }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  // Employee Selection State
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [userSearch, setUserSearch] = useState<string>("");
  const [isUserSearching, setIsUserSearching] = useState<boolean>(false);
  const [note, setNote] = useState<string>("");

  // TMZ Product Rows State
  const [rows, setRows] = useState<ProductRow[]>([
    {
      rowId: "1",
      productId: "",
      productName: "",
      unit: "dona",
      availableQty: 0,
      quantity: 1,
      searchInput: "",
    },
  ]);

  const [activeSearchRowId, setActiveSearchRowId] = useState<string | null>(
    null,
  );
  const [talabnomaData, setTalabnomaData] = useState<TalabnomaData | null>(
    null,
  );

  // Fetch Users (server-side search enabled)
  const { data: usersData, isLoading: isUsersLoading } = useQuery({
    queryKey: ["users-all-give-tmz-user", userSearch],
    queryFn: () => usersApi.getAll({ search: userSearch.trim() || undefined, limit: 100 }),
    enabled: open,
  });

  // Fetch Products
  const { data: productsData } = useQuery({
    queryKey: ["products-consumable-give-tmz-user"],
    queryFn: () =>
      productsApi.getAll({ productType: "SARFLANADIGAN", limit: 200 }),
    enabled: open,
  });

  // Fetch Inventory
  const { data: inventoryData } = useQuery({
    queryKey: ["inventory-all-give-tmz-user"],
    queryFn: () => inventoryApi.getAll(),
    enabled: open,
  });

  // Parse Users List
  const rawUsersData = usersData as any;
  const usersList: any[] = Array.isArray(rawUsersData)
    ? rawUsersData
    : Array.isArray(rawUsersData?.items)
      ? rawUsersData.items
      : Array.isArray(rawUsersData?.data)
        ? rawUsersData.data
        : Array.isArray(rawUsersData?.data?.items)
          ? rawUsersData.data.items
          : [];

  // Parse Products & Inventory List
  const rawProductsData = productsData as any;
  const rawProductArray: any[] = Array.isArray(rawProductsData)
    ? rawProductsData
    : Array.isArray(rawProductsData?.items)
      ? rawProductsData.items
      : Array.isArray(rawProductsData?.data)
        ? rawProductsData.data
        : Array.isArray(rawProductsData?.data?.items)
          ? rawProductsData.data.items
          : [];

  const rawInventoryArray: any[] = Array.isArray(inventoryData)
    ? inventoryData
    : Array.isArray((inventoryData as any)?.data)
      ? (inventoryData as any).data
      : [];

  const productList: any[] = [];
  if (rawProductArray.length > 0) {
    for (const p of rawProductArray) {
      if (p.productType && p.productType !== "SARFLANADIGAN") continue;
      const invMatch = rawInventoryArray.find(
        (inv: any) => inv.productId === p.id || inv.product?.id === p.id,
      );
      const qty = invMatch?.quantity ?? p.inventory?.quantity ?? 0;
      productList.push({
        id: p.id,
        name: p.name,
        unit: p.unit || "dona",
        quantity: qty,
      });
    }
  } else if (rawInventoryArray.length > 0) {
    for (const inv of rawInventoryArray) {
      const p = inv.product;
      if (!p || (p.productType && p.productType !== "SARFLANADIGAN")) continue;
      productList.push({
        id: p.id,
        name: p.name,
        unit: p.unit || "dona",
        quantity: inv.quantity ?? 0,
      });
    }
  }

  // Filtered Users matching userSearch
  const filteredUsers = usersList.filter((u: any) => {
    const q = userSearch.toLowerCase().trim();
    if (!q) return true;
    const name = String(u.fullName || "").toLowerCase();
    const uname = String(u.username || "").toLowerCase();
    const dept = String(u.department?.name || "").toLowerCase();
    const pos = String(u.position || "").toLowerCase();
    return (
      name.includes(q) ||
      uname.includes(q) ||
      dept.includes(q) ||
      pos.includes(q)
    );
  });

  // Handlers for Row Operations
  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      {
        rowId: Date.now().toString(),
        productId: "",
        productName: "",
        unit: "dona",
        availableQty: 0,
        quantity: 1,
        searchInput: "",
      },
    ]);
  };

  const handleRemoveRow = (rowId: string) => {
    if (rows.length === 1) return;
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));
  };

  const handleSelectProduct = (rowId: string, prod: any) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.rowId === rowId) {
          return {
            ...r,
            productId: prod.id,
            productName: prod.name,
            unit: prod.unit || "dona",
            availableQty: prod.quantity ?? 0,
            searchInput: prod.name,
          };
        }
        return r;
      }),
    );
    setActiveSearchRowId(null);
  };

  const handleRowQtyChange = (rowId: string, qty: number) => {
    setRows((prev) =>
      prev.map((r) =>
        r.rowId === rowId ? { ...r, quantity: Math.max(1, qty) } : r,
      ),
    );
  };

  const handleClearProduct = (rowId: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.rowId === rowId
          ? {
              ...r,
              productId: "",
              productName: "",
              unit: "dona",
              availableQty: 0,
              searchInput: "",
            }
          : r,
      ),
    );
  };

  // Submit Mutation
  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      if (!selectedUser) {
        throw new Error(t('operations.selectUserFirst'));
      }

      const validRows = rows.filter((r) => r.productId && r.quantity > 0);
      if (validRows.length === 0) {
        throw new Error(t('operations.selectMaterialFirst'));
      }

      // Check stock limits
      for (const r of validRows) {
        if (r.quantity > r.availableQty) {
          throw new Error(
            `"${r.productName}" bo'yicha omborda yetarli qoldiq yo'q! Mavjud: ${r.availableQty} ${r.unit}`,
          );
        }
      }

      const sharedDocNum = `TLB-${Date.now().toString().slice(-6)}`;

      for (const r of validRows) {
        await operationsApi.giveToUser({
          userId: selectedUser.id,
          productId: r.productId,
          quantity: r.quantity,
          documentNumber: sharedDocNum,
          note: note || undefined,
        });
      }

      return {
        sharedDocNum,
        validRows,
      };
    },
    onSuccess: (data) => {
      const recipientName = `${selectedUser.fullName} (${selectedUser.department?.name || "Bo‘lim"})`;

      const tData: TalabnomaData = {
        documentNumber: data.sharedDocNum,
        date: new Date(),
        fromUser: user?.fullName || "Xo‘jalik mudiri A.Urunbadalov",
        toRecipient: recipientName,
        items: data.validRows.map((r) => ({
          name: r.productName,
          unit: r.unit,
          quantity: r.quantity,
        })),
        note: note || undefined,
      };

      toast.success(t('operations.giveTmzSuccess'));
      invalidateAppQueries(queryClient);
      handleReset();
      onClose();
      setTalabnomaData(tData);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Material berishda xatolik yuz berdi");
    },
  });

  const handleReset = () => {
    setSelectedUser(null);
    setUserSearch("");
    setIsUserSearching(false);
    setNote("");
    setRows([
      {
        rowId: "1",
        productId: "",
        productName: "",
        unit: "dona",
        availableQty: 0,
        quantity: 1,
        searchInput: "",
      },
    ]);
  };

  const handleCloseModal = () => {
    handleReset();
    onClose();
  };

  return (
    <>
      <Modal
        open={open}
        onClose={handleCloseModal}
        title={`👤 ${t('operations.giveToUserModalTitle')}`}
        size="lg"
      >
        <div className="space-y-3.5">
          {/* STEP 1: EMPLOYEE LIVE SEARCH */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />{" "}
              {t('operations.selectUserLabel')}
            </label>

            {selectedUser ? (
              <div className="flex items-center justify-between bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-300/80 dark:border-emerald-800/80 px-3 py-1.5 rounded-xl shadow-2xs">
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  {/* Initials Avatar */}
                  <div className="w-12 h-12 rounded-full bg-emerald-600 text-white font-extrabold text-3xs flex items-center justify-center shrink-0">
                    {selectedUser.fullName
                      ? selectedUser.fullName
                          .split(" ")
                          .slice(0, 2)
                          .map((n: string) => n[0])
                          .join("")
                          .toUpperCase()
                      : "X"}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">
                      {selectedUser.fullName}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {selectedUser.position || "Xodim"}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedUser(null);
                    setUserSearch("");
                    setIsUserSearching(true);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded-md transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-900/30 shrink-0"
                >
                  <X className="w-3 h-3" />
                  {t('common.change')}
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder={t('operations.userSearchPlaceholder')}
                    value={userSearch}
                    onFocus={() => setIsUserSearching(true)}
                    onChange={(e) => {
                      setUserSearch(e.target.value);
                      setIsUserSearching(true);
                    }}
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50/80 dark:bg-gray-800/60 focus:bg-white dark:focus:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all"
                  />
                </div>

                {isUserSearching && (
                  <div className="absolute left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-30 divide-y divide-gray-100 dark:divide-gray-800">
                    {isUsersLoading ? (
                      <div className="p-3 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />{" "}
                        {t('operations.searchingUsers')}
                      </div>
                    ) : filteredUsers.length === 0 ? (
                      <div className="p-3 text-center text-xs text-gray-400">
                        {t('operations.userNotFound')}
                      </div>
                    ) : (
                      filteredUsers.slice(0, 20).map((u: any) => (
                        <div
                          key={u.id}
                          onClick={() => {
                            setSelectedUser(u);
                            setUserSearch(u.fullName);
                            setIsUserSearching(false);
                          }}
                          className="p-2 px-3 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/40 cursor-pointer flex items-center justify-between transition-colors text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold text-3xs flex items-center justify-center shrink-0">
                              {u.fullName ? u.fullName[0].toUpperCase() : "X"}
                            </div>
                            <div>
                              <span className="font-bold text-gray-900 dark:text-gray-100 mr-2">
                                {u.fullName}
                              </span>
                              <span className="text-3xs text-gray-500">
                                {u.position || "Xodim"}
                                {u.department?.name
                                  ? ` • ${u.department.name}`
                                  : ""}
                              </span>
                            </div>
                          </div>
                          <span className="text-3xs font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-100/90 dark:bg-emerald-900/60 px-2 py-0.5 rounded-md">
                            {t('common.select')}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* STEP 2: MULTI-ROW PRODUCT SEARCH & SELECTION */}
          <div className="space-y-2 pt-2.5 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                {t('operations.giveToUserMaterialSubtitle')}
              </label>
            </div>

            <div className="space-y-2">
              {rows.map((row, idx) => {
                const matchingProducts = productList.filter((p: any) => {
                  const q = row.searchInput.toLowerCase().trim();
                  if (!q) return true;
                  return String(p.name || "")
                    .toLowerCase()
                    .includes(q);
                });

                return (
                  <div
                    key={row.rowId}
                    className="p-2.5 bg-gray-50/70 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/80 rounded-xl space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs font-extrabold text-gray-500">
                      <span>#{idx + 1}</span>
                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.rowId)}
                          className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 flex items-center gap-0.5"
                          title={t('common.delete')}
                        >
                          <Trash2 className="w-3 h-3" /> {t('common.delete')}
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                      <div className="sm:col-span-2 relative">
                        {row.productId ? (
                          <div className="flex items-center justify-between bg-white dark:bg-gray-900 border border-emerald-300 dark:border-emerald-800 px-2.5 py-1.5 rounded-lg shadow-2xs text-xs">
                            <div className="min-w-0 pr-2 flex items-center gap-2">
                              <span className="font-bold text-gray-900 dark:text-gray-100 truncate">
                                {row.productName}
                              </span>
                              <span className="text-3xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 rounded shrink-0">
                                {t('operations.availableQtyLabel', { count: row.availableQty, unit: row.unit })}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleClearProduct(row.rowId)}
                              className="text-3xs font-bold text-rose-500 hover:underline shrink-0"
                            >
                              {t('common.change')}
                            </button>
                          </div>
                        ) : (
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                            <input
                              type="text"
                              placeholder={t('operations.materialSearchPlaceholder')}
                              value={row.searchInput}
                              onFocus={() => setActiveSearchRowId(row.rowId)}
                              onChange={(e) => {
                                const val = e.target.value;
                                setRows((prev) =>
                                  prev.map((r) =>
                                    r.rowId === row.rowId
                                      ? { ...r, searchInput: val }
                                      : r,
                                  ),
                                );
                                setActiveSearchRowId(row.rowId);
                              }}
                              className="w-full pl-7 pr-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all"
                            />

                            {activeSearchRowId === row.rowId && (
                              <div className="absolute left-0 right-0 top-full mt-1 max-h-44 overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-30 divide-y divide-gray-100 dark:divide-gray-800">
                                {matchingProducts.length === 0 ? (
                                  <div className="p-2.5 text-xs text-gray-400 text-center">
                                    {t('operations.materialNotFound')}
                                  </div>
                                ) : (
                                  matchingProducts
                                    .slice(0, 15)
                                    .map((p: any) => {
                                      const qty = p.quantity ?? 0;
                                      const isOutOfStock = qty <= 0;
                                      return (
                                        <div
                                          key={p.id}
                                          onClick={() => {
                                            if (isOutOfStock) {
                                              toast.error(`"${p.name}" omborda mavjud emas! Mavjud qoldiq: 0 ${p.unit || 'dona'}`);
                                              return;
                                            }
                                            handleSelectProduct(row.rowId, p);
                                          }}
                                          className={`p-2 px-3 flex items-center justify-between text-xs transition-colors ${
                                            isOutOfStock
                                              ? 'opacity-60 bg-gray-50 dark:bg-gray-800/40 cursor-not-allowed select-none'
                                              : 'hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer'
                                          }`}
                                        >
                                          <span className={`font-bold ${isOutOfStock ? 'text-gray-500 line-through' : 'text-gray-900 dark:text-gray-100'}`}>
                                            {p.name}
                                          </span>
                                          {isOutOfStock ? (
                                            <span className="text-3xs font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950 px-1.5 py-0.5 rounded shrink-0">
                                              {t('operations.outOfStockBadge')}
                                            </span>
                                          ) : (
                                            <span className="text-3xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 rounded shrink-0">
                                              {t('operations.availableQtyLabel', { count: qty, unit: p.unit })}
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div>
                        <Input
                          type="number"
                          min={1}
                          max={row.availableQty > 0 ? row.availableQty : 9999}
                          value={row.quantity}
                          onChange={(e) =>
                            handleRowQtyChange(
                              row.rowId,
                              parseInt(e.target.value, 10) || 1,
                            )
                          }
                          placeholder={t('inventory.quantity')}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* PLUS (+) BUTTON TO ADD MORE PRODUCT ROWS */}
            <div className="pt-0.5">
              <Button
                type="button"
                variant="outline"
                onClick={handleAddRow}
                icon={<Plus className="w-3.5 h-3.5 text-emerald-500" />}
                className="w-full py-1.5 border-dashed border-emerald-300 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-xs font-bold rounded-xl"
              >
              {t('operations.addMoreMaterials')}
              </Button>
            </div>
          </div>

          <div className="pt-1">
            <Input
              label={t('common.note')}
              placeholder={t('inventory.notePlaceholder')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {/* FOOTER ACTIONS */}
          <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100 dark:border-gray-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCloseModal}
              disabled={isPending}
            >
              {t('common.cancel')}
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => mutate()}
              loading={isPending}
              disabled={!selectedUser || isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {t('operations.giveTmzSubmitBtn')}
            </Button>
          </div>
        </div>
      </Modal>

      {talabnomaData && (
        <TalabnomaModal
          open={!!talabnomaData}
          onClose={() => setTalabnomaData(null)}
          data={talabnomaData}
        />
      )}
    </>
  );
}
