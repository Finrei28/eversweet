"use client";

import { CustomerInfo } from "~/app/components/types";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";

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
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Your Information</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name</Label>
            <Input
              id="firstName"
              name="firstName"
              value={customerInfo.firstName}
              onChange={handleCustomerInfoChange}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name</Label>
            <Input
              id="lastName"
              name="lastName"
              value={customerInfo.lastName}
              onChange={handleCustomerInfoChange}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={customerInfo.email}
              onChange={handleCustomerInfoChange}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <PhoneInput
              country={"nz"} // Automatically sets +64 and NZ flag
              value={customerInfo.phone}
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
