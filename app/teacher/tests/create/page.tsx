import { auth } from "@/auth";
import { redirect } from "next/navigation";
import CreateTestBankForm from "./_components/CreateTestBankForm";

export default async function CreateTestBankPage() {
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")
  ) {
    return redirect("/login");
  }

  return <CreateTestBankForm />;
}
