"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireActivityActor, requireUser } from "@/lib/auth";
import {
  addActivityLog,
  addTodoItem,
  deleteTodoItem,
  setTodoItemCompleted,
  updateTodoItem
} from "@/lib/inspection-service";

export async function addTodoItemAction(formData: FormData) {
  const user = await requireUser();
  const actor = await requireActivityActor();
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

  await addActivityLog({
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    action: "todo.created",
    entityType: "todo",
    targetLabel: title
  });

  revalidatePath("/");
  redirect("/?todo=added");
}

export async function updateTodoItemAction(formData: FormData) {
  const user = await requireUser();
  const actor = await requireActivityActor();
  const id = String(formData.get("id") || "");
  const title = String(formData.get("title") || "");
  const description = String(formData.get("description") || "");
  const dueDate = String(formData.get("dueDate") || "");
  const completedValue = String(formData.get("completed") || "");
  const completed = completedValue === "on" || completedValue === "true";

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

  await addActivityLog({
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    action: "todo.updated",
    entityType: "todo",
    entityId: id,
    targetLabel: title
  });

  revalidatePath("/");
  redirect("/?todo=updated");
}

export async function deleteTodoItemAction(formData: FormData) {
  const user = await requireUser();
  const actor = await requireActivityActor();
  const id = String(formData.get("id") || "");

  if (!id) {
    redirect("/?todo=error");
  }

  await deleteTodoItem({
    id,
    ownerId: String(user?.id ?? "demo-user")
  });

  await addActivityLog({
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    action: "todo.deleted",
    entityType: "todo",
    entityId: id,
    targetLabel: `Notitie ${id}`
  });

  revalidatePath("/");
  redirect("/?todo=deleted");
}

export async function toggleTodoItemCompletedAction(formData: FormData) {
  const user = await requireUser();
  const actor = await requireActivityActor();
  const id = String(formData.get("id") || "");
  const nextCompleted = String(formData.get("nextCompleted") || "") === "true";

  if (!id) {
    redirect("/?todo=error");
  }

  await setTodoItemCompleted({
    id,
    ownerId: String(user?.id ?? "demo-user"),
    completed: nextCompleted
  });

  await addActivityLog({
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    action: "todo.completed",
    entityType: "todo",
    entityId: id,
    targetLabel: `Notitie ${id}`,
    details: { completed: nextCompleted }
  });

  revalidatePath("/");
  redirect("/?todo=updated");
}
