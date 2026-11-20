"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  CircleCheck,
  CircleX,
  Clock,
  Mail,
  Phone,
  Printer,
  SearchX,
  ShoppingBag,
  User,
  type LucideIcon,
} from "lucide-react";

import Loader from "~/app/components/customLoading";
import { ItemName } from "~/app/components/itemName";
import { useLanguage } from "~/app/components/language";
import { Button } from "~/components/ui/button";
import { formatCurrency } from "~/lib/formatters";
import { formatPhoneNumber } from "~/lib/phoneNumber";
import { orderPlacedLabel, pickUpDateTimeLabel } from "~/lib/pickUpLabels";
import { cn } from "~/lib/utils";
import { api, type RouterOutputs } from "~/trpc/react";
import EarnInTheApp from "./_components/earnInTheApp";
import {
  customisationPrefix,
  linePrices,
  orderPageState,
} from "./_components/orderDisplay";

type OrderItem = NonNullable<
  RouterOutputs["order"]["getOrder"]
>["desserts"][number];

function OrderDetails() {
  const { language } = useLanguage();
  const en = language === "en";
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const [isClient, setIsClient] = useState(false);
  const router = useRouter();
  const {
    data: order,
    isLoading,
    error,
  } = api.order.getOrder.useQuery(
    { id: orderId ?? "" },
    { enabled: !!orderId && isClient },
  );

  useEffect(() => {
    setIsClient(true);

    //If no order id or order is picked up and its been 24 hours already then redirect user back to home page
    if (!orderId) {
      router.push("/");
    }
  }, [orderId, router, isLoading]);

  if (!isClient || isLoading) {
    return <Loader />;
  }

  const handlePrint = () => {
    window.print();
  };

  const state = orderPageState(order, !!error, Date.now());

  // Cancelled by the shop: no live receipt for an order that is not going ahead.
  if (state === "cancelled") {
    return (
      <OrderMessage
        icon={CircleX}
        tone="destructive"
        title={en ? "Order cancelled" : "订单已取消"}
      >
        {en
          ? "The shop cancelled this order, because something was wrong with it or it has been refunded."
          : "订单出现问题或已退款，已被店家取消。"}
      </OrderMessage>
    );
  }

  if (state === "picked-up") {
    return (
      <OrderMessage
        icon={CircleCheck}
        tone="success"
        title={en ? "Order picked up" : "订单已取"}
      >
        {en
          ? "Seems like your order has already been picked up. Thank you for your order!"
          : "看起来您的订单已经被取走了。谢谢您的订购！"}
      </OrderMessage>
    );
  }

  if (state !== "confirmed" || !order) {
    return (
      <OrderMessage
        icon={SearchX}
        tone="muted"
        title={en ? "Order not found" : "未找到订单"}
      >
        {en
          ? "Looks like your order has expired or does not exist. Please check the order ID and try again."
          : "我们找不到您要查找的订单。请检查订单 ID 并重试。"}
      </OrderMessage>
    );
  }

  const placedAt = new Date(order.createdAt);
  const pickUpAt = new Date(order.pickUpTime);

  // In the pick-up card on a wide screen, and beside "Need help?" on a phone, as the
  // mock-ups draw it. Neither prints.
  const printButton = (className: string) => (
    <Button
      variant="outline"
      size="pill-sm"
      onClick={handlePrint}
      className={cn("print:hidden [&_svg]:size-[18px]", className)}
    >
      <Printer strokeWidth={1.8} aria-hidden />
      {en ? "Print receipt" : "打印收据"}
    </Button>
  );

  // One column on a phone: the heading, when to pick up, the items, who ordered, and where
  // to go next. From `lg` the items and the details sit side by side under the pick-up card.
  //
  // The receipt prints what it printed before the redesign, in the same order: the order
  // number and date, the pick-up time, the details, the items and totals, and the thank-you
  // below. The heading, the buttons and the app card stay on screen. A print is narrower
  // than `lg`, so it takes the phone's single column.
  return (
    <div className="mx-auto w-full max-w-[680px] px-5 pb-10 pt-8 lg:max-w-[1240px] lg:pb-14 lg:pt-12 print:max-w-none print:px-0 print:pb-0 print:pt-6">
      <section className="flex flex-col items-start gap-3.5 lg:flex-row lg:items-center lg:gap-7">
        {/* The 甜 seal, which the app gives a moment worth marking. */}
        <span
          aria-hidden
          className="flex h-[68px] w-[68px] shrink-0 -rotate-[4deg] items-center justify-center rounded-[11px] bg-accent lg:h-[84px] lg:w-[84px] lg:rounded-[12px] print:hidden"
        >
          <span className="font-zh text-[39px] font-black leading-none text-accent-foreground lg:text-5xl lg:leading-none">
            甜
          </span>
        </span>
        <div className="mt-1 flex flex-col gap-3.5 lg:mt-0 lg:flex-1 lg:gap-1.5 print:hidden">
          <h1 className="text-[32px] font-extrabold leading-[1.05] lg:text-5xl lg:leading-[1.05] lg:tracking-[-0.01em]">
            {en ? "Order confirmed" : "订单已确认"}
          </h1>
          <p className="text-base leading-[1.45] text-muted-foreground lg:text-lg">
            {en
              ? "Your order has been received and is being prepared."
              : "您的订单已收到并正在准备中。"}
          </p>
        </div>
        <div className="mt-1 flex w-full flex-wrap items-baseline justify-between gap-x-3 gap-y-1 lg:mt-0 lg:w-auto lg:flex-col lg:items-end lg:gap-2.5">
          <p className="text-2xl font-extrabold tabular-nums lg:text-[30px] lg:leading-tight">
            {en ? "Order " : "单号 "}#{order.tempOrderId}
          </p>
          <p className="text-sm tabular-nums text-muted-foreground lg:text-[15px]">
            <time dateTime={placedAt.toISOString()}>
              {orderPlacedLabel(placedAt, language)}
            </time>
          </p>
        </div>
      </section>

      <section className="mt-5 flex flex-col gap-1.5 rounded-card bg-secondary p-5 lg:mt-7 lg:flex-row lg:items-center lg:gap-[18px] lg:px-7 lg:py-6 print:border print:border-dashed print:border-input">
        <span
          aria-hidden
          className="hidden h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-background lg:flex"
        >
          <Clock className="h-[26px] w-[26px]" strokeWidth={1.9} />
        </span>
        <div className="flex flex-col gap-1.5 lg:flex-1 lg:gap-0.5">
          <p className="flex items-center gap-2.5 text-[15px] font-bold lg:hidden">
            <Clock className="h-5 w-5" strokeWidth={1.9} aria-hidden />
            {en ? "Pick-up time" : "取货时间"}
          </p>
          <p className="text-2xl font-extrabold tabular-nums leading-[1.15] lg:text-[22px] lg:leading-snug">
            <span className="hidden lg:inline">
              {en ? "Pick-up time at " : "取货时间："}
            </span>
            <time dateTime={pickUpAt.toISOString()}>
              {pickUpDateTimeLabel(pickUpAt, language)}
            </time>
          </p>
          <p className="text-[15px] leading-[1.45]">
            {en
              ? "Please have your order number ready when you arrive."
              : "来取的时候，请准备好您的订单号。"}
          </p>
        </div>
        {printButton(
          "hidden border-0 bg-background shadow-none hover:bg-muted lg:inline-flex lg:px-5",
        )}
      </section>

      <div className="mt-7 grid grid-cols-1 gap-7 lg:mt-9 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
        <section
          aria-labelledby="order-items-heading"
          className="flex flex-col"
        >
          <h2
            id="order-items-heading"
            className="mb-0.5 text-xl font-extrabold lg:mb-1 lg:text-[22px]"
          >
            {en ? "Order items" : "订购商品"}
          </h2>
          <ul>
            {order.desserts.map((item) => (
              <ReceiptLine key={item.id} item={item} />
            ))}
          </ul>
          <div className="flex justify-between pb-1 pt-3.5 text-[15px] text-muted-foreground lg:pb-1.5 lg:pt-4">
            <span>{en ? "GST included" : "包含消费税"}</span>
            <span className="tabular-nums">
              {formatCurrency((order.priceInCents * 3) / 23 / 100 || 0)}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-[17px] font-extrabold lg:text-lg">
              {en ? "Total" : "总计"}
            </span>
            <span className="text-2xl font-extrabold tabular-nums lg:text-[26px]">
              {formatCurrency(order.priceInCents / 100)}
            </span>
          </div>
        </section>

        {/* First on paper, where the receipt has always given who ordered before what. */}
        <div className="flex flex-col gap-6 lg:gap-7 print:order-first">
          <section
            aria-labelledby="customer-details-heading"
            className="flex flex-col"
          >
            <h2
              id="customer-details-heading"
              className="mb-0.5 text-xl font-extrabold lg:mb-1 lg:text-[22px]"
            >
              {en ? "Customer details" : "客户详情"}
            </h2>
            <ul className="text-[15px] lg:text-base">
              <DetailRow icon={User}>
                {order.customerFirstName} {order.customerLastName}
              </DetailRow>
              <DetailRow icon={Mail}>{order.customerEmail}</DetailRow>
              {/* Optional on the row: an order from the app may have none. */}
              {order.customerPhoneNumber && (
                <DetailRow icon={Phone} className="tabular-nums">
                  {formatPhoneNumber(order.customerPhoneNumber)}
                </DetailRow>
              )}
            </ul>
          </section>

          <div className="flex flex-col gap-2.5 print:hidden">
            {/* Links drawn as buttons. Each was a button inside a link, which is two
                controls in one for a keyboard and a screen reader. */}
            <Button asChild size="cta" className="w-full">
              <Link href="/">{en ? "Return to home" : "返回首页"}</Link>
            </Button>
            <div className="grid grid-cols-2 gap-2.5">
              <Button
                asChild
                variant="secondary"
                size="pill"
                className="col-span-2 lg:col-span-1"
              >
                <Link href="/menu">
                  <ArrowLeft strokeWidth={2} aria-hidden />
                  {en ? "Back to menu" : "返回菜单"}
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="pill-sm"
                className="shadow-none lg:h-[52px] lg:border-0 lg:bg-secondary lg:text-base lg:hover:bg-secondary lg:hover:brightness-95"
              >
                <Link href="/contact">
                  {en ? "Need help?" : "需要帮助吗？"}
                </Link>
              </Button>
              {printButton("shadow-none lg:hidden")}
            </div>
          </div>
        </div>
      </div>

      {/* `getOrder` finds any order by id, and an app order did earn its points. */}
      {order.source === "WEBSITE" && <EarnInTheApp />}

      {/* Print-only footer */}
      <div className="mt-8 hidden text-center text-sm text-muted-foreground print:block">
        <p>{en ? "Thank you for your order!" : "感谢您的订购！"}</p>
        <p className="mt-1">
          {en
            ? "For any questions, please contact us at eversweet@eversweet.co.nz"
            : "如有任何疑问，请联系我们: eversweet@eversweet.co.nz"}
        </p>
      </div>
    </div>
  );
}

/** A dessert on the receipt: its photo, both its names, what was changed, and its price. */
function ReceiptLine({ item }: { item: OrderItem }) {
  const { language } = useLanguage();
  const en = language === "en";
  const { eachInCents, lineInCents } = linePrices(item);

  return (
    <li className="flex break-inside-avoid gap-3 border-b border-border py-3.5 lg:gap-4 lg:py-4">
      <span className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted lg:h-[60px] lg:w-[60px]">
        {item.dessert.imagePath ? (
          <Image
            src={item.dessert.imagePath}
            alt=""
            fill
            sizes="60px"
            className="object-cover"
          />
        ) : (
          <ShoppingBag className="h-6 w-6 text-muted-foreground" aria-hidden />
        )}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-px lg:gap-0.5">
        <ItemName
          name={item.dessert.name}
          chineseName={item.dessert.chineseName}
          leadClassName="text-base lg:text-[17px]"
        />
        {item.customisations.map(({ id, quantity, customisation }) => (
          <p
            key={id}
            className="flex flex-wrap items-baseline gap-x-1.5 text-[13px] text-muted-foreground lg:text-sm"
          >
            <span className="tabular-nums">
              {customisationPrefix(quantity)}
            </span>
            <span
              lang={en ? "en" : "zh-Hans"}
              className={cn(!en && "font-zh font-semibold")}
            >
              {en ? customisation.name : customisation.chineseName}
            </span>
            <span
              lang={en ? "zh-Hans" : "en"}
              className={cn("text-xs", en && "font-zh font-semibold")}
            >
              {en ? customisation.chineseName : customisation.name}
            </span>
          </p>
        ))}
        <p className="text-[13px] text-muted-foreground lg:text-sm">
          {en ? "Quantity: " : "数量: "}
          {item.quantity}
        </p>
      </div>

      {/* The line's total, and for more than one, what each cost. */}
      <div className="shrink-0 text-right tabular-nums">
        <p className="text-base font-bold lg:text-[17px]">
          {formatCurrency(lineInCents / 100)}
        </p>
        {item.quantity > 1 && (
          <p className="text-[13px] text-muted-foreground lg:text-sm">
            {item.quantity} × {formatCurrency(eachInCents / 100)}
          </p>
        )}
      </div>
    </li>
  );
}

function DetailRow({
  icon: Icon,
  className,
  children,
}: {
  icon: LucideIcon;
  className?: string;
  children: ReactNode;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 border-b border-border py-3 last:border-b-0 lg:py-3.5",
        className,
      )}
    >
      <Icon
        className="h-5 w-5 shrink-0 text-muted-foreground"
        strokeWidth={1.8}
        aria-hidden
      />
      <span className="min-w-0 [overflow-wrap:anywhere]">{children}</span>
    </li>
  );
}

const TONES = {
  destructive: { circle: "bg-destructive-soft", icon: "text-destructive" },
  success: { circle: "bg-success-soft", icon: "text-success" },
  muted: { circle: "bg-muted", icon: "text-muted-foreground" },
} as const;

/**
 * The cancelled, picked-up and not-found states, drawn as the checkout's empty cart is: a
 * circle, the page's heading, a line, and the way home.
 *
 * They sit in the page, centred in a region most of a screen tall, with the footer below.
 * They used to be `fixed inset-0`, centred on the viewport, which floated each over the
 * footer once it rendered on every page, and kept its links from being clicked.
 */
function OrderMessage({
  icon: Icon,
  tone,
  title,
  children,
}: {
  icon: LucideIcon;
  tone: keyof typeof TONES;
  title: string;
  children: ReactNode;
}) {
  const { language } = useLanguage();

  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center gap-3 px-8 py-10 text-center">
      <span
        className={cn(
          "mb-1 flex h-20 w-20 items-center justify-center rounded-full",
          TONES[tone].circle,
        )}
      >
        <Icon
          className={cn("h-10 w-10", TONES[tone].icon)}
          strokeWidth={1.8}
          aria-hidden
        />
      </span>
      <h1 className="text-2xl font-extrabold">{title}</h1>
      <p className="text-[15px] text-muted-foreground">{children}</p>
      {/* A link drawn as a button; it was a button inside a link. */}
      <Button asChild size="pill-sm" className="mt-3">
        <Link href="/">
          {language === "en" ? "Return to home" : "返回首页"}
        </Link>
      </Button>
    </div>
  );
}

export default function OrderPage() {
  return (
    <Suspense fallback={<Loader />}>
      <OrderDetails />
    </Suspense>
  );
}
