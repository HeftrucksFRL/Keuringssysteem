"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { addTodoItem, deleteTodoItem, updateTodoItem } from "@/lib/inspection-service";

export async function addTodoItemAction(formData: FormData) {
  const user = await requireUser();
  const title = String(formData.get("title") || "");
  const description = String(formData.get("description") || "");
  const dueDate = String(formData.get("dueDate") || "");

  if (!title.trim()) {
    redirect("/?todo=error");
  }

  await addTodoItem({
    ownerId: String(user?.id ?? "demo-user"),
    title,
    description,
    dueDate
  });

  revalidatePath("/");
  redirect("/?todo=added");
}

export async function updateTodoItemAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") || "");
  const title = String(formData.get("title") || "");
  const description = String(formData.get("description") || "");
  const dueDate = String(formData.get("dueDate") || "");
  const completed = String(formData.get("completed") || "") === "on";

  if (!id || !title.trim()) {
    redirect("/?todo=error");
  }

  await updateTodoItem({
    id,
    ownerId: String(user?.id ?? "demo-user"),
    title,
    description,
    dueDate,
    completed
  });

  revalidatePath("/");
  redirect("/?todo=updated");
}

export async function deleteTodoItemAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") || "");

  if (!id) {
    redirect("/?todo=error");
  }

  await deleteTodoItem({
    id,
    ownerId: String(user?.id ?? "demo-user")
  });

  revalidatePath("/");
  redirect("/?todo=deleted");
}
