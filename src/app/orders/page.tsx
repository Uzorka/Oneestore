import { redirect } from "next/navigation";

/** Orders moved into the account. Keep old links working. */
export default function OrdersRedirect() {
  redirect("/account/orders");
}
