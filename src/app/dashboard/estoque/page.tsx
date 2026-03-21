import { redirect } from "next/navigation";

export default function DashboardEstoqueRedirectPage() {
  redirect("/operator/estoque");
}
