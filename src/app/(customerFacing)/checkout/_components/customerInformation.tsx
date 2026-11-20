"use client";

import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";

import { useLanguage } from "~/app/components/language";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import type { CustomerInfo } from "~/lib/types";
import { cn } from "~/lib/utils";

type customerInformationProps = {
  customerInfo: CustomerInfo;
  handleCustomerInfoChange: (
    value: string | React.ChangeEvent<HTMLInputElement>,
  ) => void;
  className?: string;
};

/**
 * The customer's name, email and phone. Every field is needed, so none is marked.
 *
 * The phone field is react-phone-input-2's, held to New Zealand. Its own stylesheet sets
 * the field's size and colours with two-class selectors, so the classes below override
 * them with `!`, and its flag button is hidden: with one country there is nothing to
 * choose, and the field shows the +64 itself.
 */
export default function CustomerInformation({
  customerInfo,
  handleCustomerInfoChange,
  className,
}: customerInformationProps) {
  const { language } = useLanguage();
  const en = language === "en";

  const fields = [
    {
      id: "customerFirstName",
      label: en ? "First name" : "名字",
      autoComplete: "given-name",
    },
    {
      id: "customerLastName",
      label: en ? "Last name" : "姓氏",
      autoComplete: "family-name",
    },
    {
      id: "customerEmail",
      label: en ? "Email" : "电子邮件",
      autoComplete: "email",
      type: "email",
    },
  ] as const;

  return (
    <section
      aria-labelledby="your-information-heading"
      className={cn(
        "flex flex-col gap-3.5 border-b border-border py-6 lg:gap-4 lg:py-8",
        className,
      )}
    >
      <h2
        id="your-information-heading"
        className="text-xl font-extrabold lg:text-2xl"
      >
        {en ? "Your information" : "您的信息"}
      </h2>
      <div className="grid gap-3.5 sm:grid-cols-2 sm:gap-x-5 sm:gap-y-[18px]">
        {fields.map((field) => (
          <div key={field.id} className="flex flex-col gap-2">
            <Label variant="field" htmlFor={field.id}>
              {field.label}
            </Label>
            <Input
              variant="field"
              id={field.id}
              name={field.id}
              type={"type" in field ? field.type : "text"}
              autoComplete={field.autoComplete}
              value={customerInfo[field.id]}
              onChange={handleCustomerInfoChange}
              required
            />
          </div>
        ))}
        <div className="flex flex-col gap-2">
          <Label variant="field" htmlFor="customerPhoneNumber">
            {en ? "Phone number" : "手机号码"}
          </Label>
          <PhoneInput
            country={"nz"} // Automatically sets +64
            value={customerInfo.phone}
            onChange={handleCustomerInfoChange}
            onlyCountries={["nz"]} // Restrict to only NZ numbers
            countryCodeEditable={false} // Prevent users from changing +64
            disableDropdown
            // The label above names this input; it used to point at nothing.
            inputProps={{
              id: "customerPhoneNumber",
              name: "phone",
              autoComplete: "tel",
              required: true,
            }}
            containerClass="!w-full !font-sans"
            inputClass="!h-[52px] !w-full !rounded-[14px] !border-input !bg-card !pl-4 !text-base !font-medium !text-foreground focus-visible:!border-foreground focus-visible:!outline-none focus-visible:!ring-1 focus-visible:!ring-ring"
            buttonClass="!hidden"
          />
        </div>
      </div>
    </section>
  );
}
