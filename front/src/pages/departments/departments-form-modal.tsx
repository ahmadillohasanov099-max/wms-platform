import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { departmentsApi } from "../../api";
import Modal from "../../components/ui/modal";
import Input from "../../components/ui/input";
import Button from "../../components/ui/button";
import { useTranslation } from "../../hooks/useTranslation";
interface Props {
  open: boolean;
  onClose: () => void;
  department?: any;
}
export default function DepartmentFormModal({ open, onClose, department }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isEdit = !!department;
  const schema = z.object({
    name: z.string().min(2, t("departments.validationName")),
    description: z.string().optional(),
  });
  type FormData = z.infer<typeof schema>;
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });
  useEffect(() => {
    if (department) {
      reset({ name: department.name, description: department.description ?? "" });
    } else {
      reset({ name: "", description: "" });
    }
  }, [department, open, reset]);
  const { mutate, isPending } = useMutation({
    mutationFn: (data: FormData) =>
      isEdit ? departmentsApi.update(department.id, data) : departmentsApi.create(data),
    onSuccess: () => {
      toast.success(isEdit ? t("departments.updateSuccess") : t("departments.createSuccess"));
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.message || err?.response?.data?.message || t("common.error"));
    },
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? t("departments.editTitle") : t("departments.addTitle")}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSubmit((data) => mutate(data))} loading={isPending}>
            {isEdit ? t("common.save") : t("common.add")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label={t("departments.name")}
          placeholder={t("departments.namePlaceholder")}
          error={errors.name?.message}
          required
          {...register("name")}
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t("common.description")}
          </label>
          <textarea
            rows={3}
            placeholder={t("departments.descPlaceholder")}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 px-3 py-2 resize-none"
            {...register("description")}
          />
        </div>
      </div>
    </Modal>
  );
}