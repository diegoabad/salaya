import { redirect } from "next/navigation";

/** Alias legacy → /soy-dueno */
export default function QueIncluyeRedirect() {
  redirect("/soy-dueno");
}
