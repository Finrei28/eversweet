"use client";

import { CustomerInfo } from "~/app/components/types";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { useLanguage } from "~/app/components/language";

type customerInformationProps = {
  customerInfo: CustomerInfo;
  handleCustomerInfoChange: (
    value: string | React.ChangeEvent<HTMLInputElement>,
  ) => void;
};

export default function CustomerInformation({
  customerInfo,
  handleCustomerInfoChange,
}: customerInformationProps) {
  const { language } = useLanguage();
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>
          {language === "en" ? "Your Information" : "您的信息"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName">
              {language === "en" ? "First Name" : "前名"}
            </Label>
            <Input
              id="firstName"
              name="firstName"
              value={customerInfo.customerFirstName}
              onChange={handleCustomerInfoChange}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">
              {language === "en" ? "Last Name" : "姓名"}
            </Label>
            <Input
              id="lastName"
              name="lastName"
              value={customerInfo.customerLastName}
              onChange={handleCustomerInfoChange}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">
              {language === "en" ? "Email" : "电子邮件"}
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={customerInfo.customerEmail}
              onChange={handleCustomerInfoChange}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">
              {language === "en" ? "Phone Number" : "手机号码"}
            </Label>
            <PhoneInput
              country={"nz"} // Automatically sets +64 and NZ flag
              value={customerInfo.customerPhoneNumber}
              onChange={handleCustomerInfoChange}
              inputStyle={{ width: "100%", paddingLeft: "50px" }} // Adjust input styling
              onlyCountries={["nz"]} // Restrict to only NZ numbers
              countryCodeEditable={false} // Prevent users from changing +64
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
