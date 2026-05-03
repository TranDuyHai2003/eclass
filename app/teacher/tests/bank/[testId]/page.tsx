import { auth } from "@/auth";
import { redirect } from "next/navigation";
import TestBankEditorClient from "./_components/TestBankEditorClient";

export default async function TestBankEditorPage({
  params,
}: {
  params: Promise<{ testId: string }>;
}) {
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")
  ) {
    return redirect("/login");
  }

  const { testId } = await params;

  return (
    <div className="min-h-screen bg-[#F6F7FB]">
      <TestBankEditorClient testId={testId} />
    </div>
  );
}
