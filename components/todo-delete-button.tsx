"use client";
import { useFormStatus } from "react-dom";
import "./todo-delete-button.css";
export function TodoDeleteButton({action}:{action:(data:FormData)=>Promise<void>}) {
  const {pending,data}=useFormStatus();
  const deleting=pending&&data?.get("todoIntent")==="delete";
  return <button className="button-secondary todo-inline-button" formAction={action} formNoValidate type="submit" name="todoIntent" value="delete" disabled={pending} data-deleting={deleting} aria-label="Notitie verwijderen">Verwijderen</button>;
}
