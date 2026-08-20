import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { usersApi } from "../../api";
import { PageLoader } from "../../components/ui/spinner";
import DepartmentDetailView from "../departments/department-detail-view";
import { useTranslation } from "../../hooks/useTranslation";

export default function UserDetailPage() {
  const { t } = useTranslation();
  const { userId } = useParams();
  const navigate = useNavigate();

  const { data: userResponse, isLoading } = useQuery({
    queryKey: ["user-detail", userId],
    queryFn: () => usersApi.getOne(userId!),
    enabled: !!userId,
  });

  const user = (userResponse as any)?.data || userResponse;

  if (isLoading) {
    return <PageLoader />;
  }

  if (!user) {
    return (
      <div className="p-6 text-center text-red-500">
        {t('userView.notFound')}
      </div>
    );
  }

  return (
    <DepartmentDetailView
      departmentId={user.departmentId}
      selectedUserId={userId}
      onBack={() => navigate("/users")}
      onSelectUser={() => {}} 
      onBackToDept={() => navigate("/users")}
    />
  );
}
