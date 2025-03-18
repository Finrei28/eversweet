import { FullOrderType } from "~/app/components/types";

import {
  formatCurrency,
  formatDate,
  getCollectionTime,
} from "~/lib/formatters";
import {
  Html,
  Button,
  Tailwind,
  Img,
  Preview,
  Head,
  Body,
  Section,
  Text,
  Heading,
  Row,
  Column,
  Container,
  Hr,
} from "@react-email/components";
import tailwindConfig from "tailwind.config";

type EmailOrderConfirmationProps = {
  order: FullOrderType;
};

const order = {
  id: "cm8ebvuwj0004vxlsm60em16g",
  tempOrderId: "10536",
  priceInCents: 8700,
  createdAt: "2025-03-18T10:05:57.391Z",
  updatedAt: "2025-03-18T10:05:57.391Z",
  customerFirstName: "Finlay",
  customerLastName: "Wong",
  customerEmail: "finlaywong@gmail.com",
  customerPhoneNumber: "64211231232",
  completedAt: null,
  pickedUpAt: null,
  status: "PENDING",
  desserts: [
    {
      id: "cm8ebvuwj000svxlsbscl6v0o",
      orderId: "cm8ebvuwj0004vxlsm60em16g",
      dessertId: "cm8bja2o10002z5di310chmtu",
      quantity: 1,
      dessert: {
        id: "cm8bja2o10002z5di310chmtu",
        name: "Apple",
        chineseName: "苹果",
        description: "Bright red juicy and sweet apples",
        priceInCents: 700,
        imagePath:
          "https://res.cloudinary.com/dlqjgl6ju/image/upload/v1742123376/products/hrg66el6lsb1x1hdlrmy.png",
        imagePublicId: "products/hrg66el6lsb1x1hdlrmy",
        ingredients: ["Apples", "Raspberries", "Sunflower seeds"],
        isAvailableForPurchase: true,
        createdAt: "2025-03-16T11:09:39.457Z",
        updatedAt: "2025-03-16T11:18:46.001Z",
      },
      customisations: [],
    },
    {
      id: "cm8ebvuwj000rvxlslbx6mmdk",
      orderId: "cm8ebvuwj0004vxlsm60em16g",
      dessertId: "cm8bj3qs80000z5dihya4yzbw",
      quantity: 1,
      dessert: {
        id: "cm8bj3qs80000z5dihya4yzbw",
        name: "Raspberry",
        chineseName: "树莓",
        description: "Sweet crunchy raspberries",
        priceInCents: 600,
        imagePath:
          "https://res.cloudinary.com/dlqjgl6ju/image/upload/v1742123080/products/kkal8p8m8rir8eradcu3.png",
        imagePublicId: "products/kkal8p8m8rir8eradcu3",
        ingredients: ["Raspberries", "Coconut", "Seaweed", "Sunflower seeds"],
        isAvailableForPurchase: true,
        createdAt: "2025-03-16T11:04:44.121Z",
        updatedAt: "2025-03-16T11:06:36.712Z",
      },
      customisations: [],
    },
    {
      id: "cm8ebvuwj000gvxlsbc1npbcg",
      orderId: "cm8ebvuwj0004vxlsm60em16g",
      dessertId: "cm8bhz3mq00001472aqyqk3a8",
      quantity: 1,
      dessert: {
        id: "cm8bhz3mq00001472aqyqk3a8",
        name: "Blueberry",
        chineseName: "蓝莓",
        description: "Delicious blueberries",
        priceInCents: 800,
        imagePath:
          "https://res.cloudinary.com/dlqjgl6ju/image/upload/v1742121184/products/bskmlhie8vcacofvcq35.webp",
        imagePublicId: "products/bskmlhie8vcacofvcq35",
        ingredients: ["Blueberries", "Sunflower seeds", "Grapes"],
        isAvailableForPurchase: true,
        createdAt: "2025-03-16T10:33:07.875Z",
        updatedAt: "2025-03-16T10:48:43.960Z",
      },
      customisations: [
        {
          id: "cm8ebvuwj000qvxlsg9q60528",
          orderDessertId: "cm8ebvuwj000gvxlsbc1npbcg",
          customisationId: "cm8bjpfe20006z5disjmfymyt",
          quantity: 1,
          customisation: {
            id: "cm8bjpfe20006z5disjmfymyt",
            name: "Melon",
            priceInCents: 300,
            isAvailableForPurchase: true,
          },
        },
        {
          id: "cm8ebvuwj000pvxlsa0qbylqc",
          orderDessertId: "cm8ebvuwj000gvxlsbc1npbcg",
          customisationId: "cm8bjqgck000bz5dikizqlcnh",
          quantity: 1,
          customisation: {
            id: "cm8bjqgck000bz5dikizqlcnh",
            name: "Strawberries",
            priceInCents: 300,
            isAvailableForPurchase: true,
          },
        },
        {
          id: "cm8ebvuwj000ovxlsy3m73b6o",
          orderDessertId: "cm8ebvuwj000gvxlsbc1npbcg",
          customisationId: "cm8bjps0b0008z5di6qed7gep",
          quantity: 1,
          customisation: {
            id: "cm8bjps0b0008z5di6qed7gep",
            name: "Custard",
            priceInCents: 250,
            isAvailableForPurchase: true,
          },
        },
        {
          id: "cm8ebvuwj000nvxlstoi5cjz4",
          orderDessertId: "cm8ebvuwj000gvxlsbc1npbcg",
          customisationId: "cm8bjsvnt000cz5didewi859n",
          quantity: 1,
          customisation: {
            id: "cm8bjsvnt000cz5didewi859n",
            name: "Raspberries",
            priceInCents: 200,
            isAvailableForPurchase: true,
          },
        },
        {
          id: "cm8ebvuwj000mvxlsxujsoslm",
          orderDessertId: "cm8ebvuwj000gvxlsbc1npbcg",
          customisationId: "cm8bjq7va000az5dii2j2nzd8",
          quantity: 1,
          customisation: {
            id: "cm8bjq7va000az5dii2j2nzd8",
            name: "Coconut",
            priceInCents: 200,
            isAvailableForPurchase: true,
          },
        },
        {
          id: "cm8ebvuwj000lvxlsjwgaiw8y",
          orderDessertId: "cm8ebvuwj000gvxlsbc1npbcg",
          customisationId: "cm8bjplj50007z5dihes41ue7",
          quantity: 1,
          customisation: {
            id: "cm8bjplj50007z5dihes41ue7",
            name: "Lettuce",
            priceInCents: 200,
            isAvailableForPurchase: true,
          },
        },
        {
          id: "cm8ebvuwj000kvxlshj61y72u",
          orderDessertId: "cm8ebvuwj000gvxlsbc1npbcg",
          customisationId: "cm8bjq0rb0009z5diq18tl0et",
          quantity: 1,
          customisation: {
            id: "cm8bjq0rb0009z5diq18tl0et",
            name: "Seaweed",
            priceInCents: 150,
            isAvailableForPurchase: true,
          },
        },
        {
          id: "cm8ebvuwj000jvxlsdjexb9fi",
          orderDessertId: "cm8ebvuwj000gvxlsbc1npbcg",
          customisationId: "cm8bjnxuq0003z5di6xdrz5i3",
          quantity: 1,
          customisation: {
            id: "cm8bjnxuq0003z5di6xdrz5i3",
            name: "Blueberries",
            priceInCents: 200,
            isAvailableForPurchase: true,
          },
        },
        {
          id: "cm8ebvuwj000ivxlsd52vfc9e",
          orderDessertId: "cm8ebvuwj000gvxlsbc1npbcg",
          customisationId: "cm8bjp7rz0005z5dim777no9d",
          quantity: 1,
          customisation: {
            id: "cm8bjp7rz0005z5dim777no9d",
            name: "Grapes",
            priceInCents: 200,
            isAvailableForPurchase: true,
          },
        },
        {
          id: "cm8ebvuwj000hvxlsnddb0465",
          orderDessertId: "cm8ebvuwj000gvxlsbc1npbcg",
          customisationId: "cm8bjp1980004z5dimzdmela6",
          quantity: 1,
          customisation: {
            id: "cm8bjp1980004z5dimzdmela6",
            name: "Sunflower seeds",
            priceInCents: 200,
            isAvailableForPurchase: true,
          },
        },
      ],
    },
    {
      id: "cm8ebvuwj0005vxlslplmz9e2",
      orderId: "cm8ebvuwj0004vxlsm60em16g",
      dessertId: "cm8bj4tuu0001z5di1zytt5cg",
      quantity: 1,
      dessert: {
        id: "cm8bj4tuu0001z5di1zytt5cg",
        name: "Strawberry",
        chineseName: "草莓",
        description: "Sweet and juicy strawberries",
        priceInCents: 700,
        imagePath:
          "https://res.cloudinary.com/dlqjgl6ju/image/upload/v1742123131/products/abclkkbk4gb5tqioccxq.webp",
        imagePublicId: "products/abclkkbk4gb5tqioccxq",
        ingredients: ["Strawberries", "Lettuce", "Sunflower seeds"],
        isAvailableForPurchase: true,
        createdAt: "2025-03-16T11:05:34.758Z",
        updatedAt: "2025-03-16T11:22:29.426Z",
      },
      customisations: [
        {
          id: "cm8ebvuwj000fvxls5hc5glaa",
          orderDessertId: "cm8ebvuwj0005vxlslplmz9e2",
          customisationId: "cm8bjp1980004z5dimzdmela6",
          quantity: 1,
          customisation: {
            id: "cm8bjp1980004z5dimzdmela6",
            name: "Sunflower seeds",
            priceInCents: 200,
            isAvailableForPurchase: true,
          },
        },
        {
          id: "cm8ebvuwj000evxlsyd53p52n",
          orderDessertId: "cm8ebvuwj0005vxlslplmz9e2",
          customisationId: "cm8bjplj50007z5dihes41ue7",
          quantity: 1,
          customisation: {
            id: "cm8bjplj50007z5dihes41ue7",
            name: "Lettuce",
            priceInCents: 200,
            isAvailableForPurchase: true,
          },
        },
        {
          id: "cm8ebvuwj000dvxlsroo8vnka",
          orderDessertId: "cm8ebvuwj0005vxlslplmz9e2",
          customisationId: "cm8bjqgck000bz5dikizqlcnh",
          quantity: 1,
          customisation: {
            id: "cm8bjqgck000bz5dikizqlcnh",
            name: "Strawberries",
            priceInCents: 300,
            isAvailableForPurchase: true,
          },
        },
        {
          id: "cm8ebvuwj000cvxlsbxtx6qy0",
          orderDessertId: "cm8ebvuwj0005vxlslplmz9e2",
          customisationId: "cm8bjq0rb0009z5diq18tl0et",
          quantity: 2,
          customisation: {
            id: "cm8bjq0rb0009z5diq18tl0et",
            name: "Seaweed",
            priceInCents: 150,
            isAvailableForPurchase: true,
          },
        },
        {
          id: "cm8ebvuwj000bvxlsvhtjwu5a",
          orderDessertId: "cm8ebvuwj0005vxlslplmz9e2",
          customisationId: "cm8bjpfe20006z5disjmfymyt",
          quantity: 2,
          customisation: {
            id: "cm8bjpfe20006z5disjmfymyt",
            name: "Melon",
            priceInCents: 300,
            isAvailableForPurchase: true,
          },
        },
        {
          id: "cm8ebvuwj000avxlshi5z8y78",
          orderDessertId: "cm8ebvuwj0005vxlslplmz9e2",
          customisationId: "cm8bjps0b0008z5di6qed7gep",
          quantity: 2,
          customisation: {
            id: "cm8bjps0b0008z5di6qed7gep",
            name: "Custard",
            priceInCents: 250,
            isAvailableForPurchase: true,
          },
        },
        {
          id: "cm8ebvuwj0009vxls79k0x821",
          orderDessertId: "cm8ebvuwj0005vxlslplmz9e2",
          customisationId: "cm8bjsvnt000cz5didewi859n",
          quantity: 2,
          customisation: {
            id: "cm8bjsvnt000cz5didewi859n",
            name: "Raspberries",
            priceInCents: 200,
            isAvailableForPurchase: true,
          },
        },
        {
          id: "cm8ebvuwj0008vxlstmwbi74n",
          orderDessertId: "cm8ebvuwj0005vxlslplmz9e2",
          customisationId: "cm8bjq7va000az5dii2j2nzd8",
          quantity: 2,
          customisation: {
            id: "cm8bjq7va000az5dii2j2nzd8",
            name: "Coconut",
            priceInCents: 200,
            isAvailableForPurchase: true,
          },
        },
        {
          id: "cm8ebvuwj0007vxlsmteg4zxu",
          orderDessertId: "cm8ebvuwj0005vxlslplmz9e2",
          customisationId: "cm8bjnxuq0003z5di6xdrz5i3",
          quantity: 2,
          customisation: {
            id: "cm8bjnxuq0003z5di6xdrz5i3",
            name: "Blueberries",
            priceInCents: 200,
            isAvailableForPurchase: true,
          },
        },
        {
          id: "cm8ebvuwj0006vxls7z3jh4l6",
          orderDessertId: "cm8ebvuwj0005vxlslplmz9e2",
          customisationId: "cm8bjp7rz0005z5dim777no9d",
          quantity: 2,
          customisation: {
            id: "cm8bjp7rz0005z5dim777no9d",
            name: "Grapes",
            priceInCents: 200,
            isAvailableForPurchase: true,
          },
        },
      ],
    },
  ],
};

export default function EmailOrderConfirmation({
  order,
}: EmailOrderConfirmationProps) {
  return (
    <Html>
      <Preview>Eversweet Order Confirmation</Preview>
      <Tailwind config={tailwindConfig}>
        <Head />

        <Body className="mx-auto max-w-3xl px-4 py-10 font-mono print:py-2">
          {/* Order Status Banner */}
          <Section className="mb-8 rounded-xl p-4 text-center lg:bg-green-50 print:hidden">
            <Heading as="h2" className="text-xl font-semibold text-green-700">
              Order Confirmed
            </Heading>
            <Text className="lg:text-green-600">Thank you for your order.</Text>

            <Text className="mt-1 lg:text-green-600">
              Your order has been received and is being prepared.
            </Text>
          </Section>

          {/* Order Details Card */}

          <Section className="overflow-hidden rounded-xl border-solid bg-white lg:border-2 lg:bg-orange-50 lg:p-6">
            <Section className="rounded-xl bg-white md:p-6">
              <Row>
                <Heading as="h2">Order #{order.tempOrderId}</Heading>
                <Text className="mt-1 flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="black"
                    width="18"
                    height="18"
                    className="mr-1"
                  >
                    <path d="M3 4c0-1.1.9-2 2-2h2V0h2v2h6V0h2v2h2c1.1 0 2 .9 2 2v16c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V4zm2 2v14h14V6H5zm2 4h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zm-8 4h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2z" />
                  </svg>
                  {formatDate(order.createdAt.toISOString())}
                </Text>
              </Row>
            </Section>

            <Section className="mb-6 mt-2 w-full rounded-xl bg-white lg:bg-orange-100 lg:p-4">
              {/* Collection Information */}
              <Row>
                <Heading
                  as="h3"
                  className="flex items-center font-semibold lg:text-lg lg:text-orange-600"
                >
                  {/* <Clock className="mr-2 h-5 w-5" /> */}
                  Collection Information
                </Heading>

                <Text className="lg:text-base lg:text-orange-400">
                  Your order will be ready for collection at{" "}
                  <strong>
                    {getCollectionTime(order.createdAt.toISOString())}
                  </strong>
                </Text>

                <Text className="lg:text-base lg:text-orange-400">
                  Please have your order number ready when you arrive.
                </Text>
              </Row>
            </Section>

            <Section>
              {/* Customer Details */}

              <Heading as="h3" className="mb-3 text-lg font-semibold">
                Customer Details
              </Heading>
              <Row>
                <Text className="flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="black"
                    width="18"
                    height="18"
                    className="mr-2"
                  >
                    <path d="M12 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 12c-4.42 0-8 2.02-8 4.5V22h16v-3.5c0-2.48-3.58-4.5-8-4.5z" />
                  </svg>
                  {order.customerFirstName} {order.customerLastName}
                </Text>

                <Text className="flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="black"
                    width="18"
                    height="18"
                    className="mr-2"
                  >
                    <path d="M2 4c0-1.1.9-2 2-2h16c1.1 0 2 .9 2 2v16c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V4zm2 0v2l8 5 8-5V4H4zm16 4-8 5-8-5v10h16V8z" />
                  </svg>
                  {order.customerEmail}
                </Text>

                <Text className="flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="black"
                    width="18"
                    height="18"
                    className="mr-2"
                  >
                    <path d="M6.62 10.79a15.91 15.91 0 0 0 6.59 6.59l2.2-2.2c.27-.27.66-.36 1.02-.26 1.12.3 2.32.46 3.57.46.55 0 1 .45 1 1v3.5c0 .55-.45 1-1 1-10.49 0-19-8.51-19-19 0-.55.45-1 1-1H6.5c.55 0 1 .45 1 1 0 1.25.16 2.45.46 3.57.1.36.01.75-.26 1.02l-2.2 2.2z" />
                  </svg>
                  +{order.customerPhoneNumber}
                </Text>
              </Row>
            </Section>

            <Hr />

            <Section className="rounded-xl bg-white md:p-4">
              {/* Order Items */}

              <Heading
                as="h3"
                className="mb-4 flex items-center text-lg font-semibold"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="black"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  width="18"
                  height="18"
                  className="mr-2"
                >
                  <path d="M6 2L3 7v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-3-5z" />
                  <path d="M3 7h18" />
                  <path d="M16 10a4 4 0 0 1-8 0" />
                </svg>
                Order Items
              </Heading>

              {order.desserts.map((item) => {
                const pricePerItem =
                  (item.dessert.priceInCents +
                    item.customisations.reduce((total, customisation) => {
                      return (
                        total +
                        customisation.customisation.priceInCents *
                          customisation.quantity
                      );
                    }, 0)) /
                  100;
                return (
                  <Row key={item.id}>
                    <Column className="h-20 w-20 py-4 align-top">
                      {item.dessert.imagePath ? (
                        <Img
                          src={item.dessert.imagePath || "/placeholder.svg"}
                          alt={item.dessert.name}
                          width={"100%"}
                          height={"100%"}
                          className="rounded-xl object-cover"
                        />
                      ) : (
                        <Column className="flex h-full w-full items-center justify-center bg-gray-100">
                          {/* <ShoppingBag className="h-8 w-8 text-gray-400" /> */}
                        </Column>
                      )}
                    </Column>
                    <Column className="flex flex-1 flex-col px-2">
                      <Row>
                        <Heading as="h4">{item.dessert.name}</Heading>

                        {item.customisations?.map((customisation) => (
                          <Text
                            className="-mb-4 -mt-4 ml-1 text-sm text-gray-500"
                            key={customisation.id}
                          >
                            {customisation.quantity > 1
                              ? `+${customisation.quantity} ${customisation.customisation.name}`
                              : customisation.quantity === 1
                                ? `+${customisation.customisation.name}`
                                : `-${customisation.customisation.name}`}
                          </Text>
                        ))}

                        <Text className="text-sm text-gray-500">
                          Quantity: {item.quantity}
                        </Text>
                      </Row>
                    </Column>
                    <Column align="right" className="align-bottom">
                      <Text className="">{formatCurrency(pricePerItem)}</Text>

                      <Text className="text-sm text-gray-500">
                        {formatCurrency(pricePerItem * item.quantity)}
                      </Text>
                    </Column>
                  </Row>
                );
              })}

              <Hr />

              {/* Order Summary */}

              <Row>
                <Text>GST included</Text>
              </Row>
              <Row>
                <Column className="align-bottom">
                  <Text>Total</Text>
                </Column>
                <Column align="right">
                  <Text>{formatCurrency(order.priceInCents / 100)}</Text>
                </Column>
              </Row>
            </Section>
          </Section>

          <Hr className="lg:hidden" />

          {/* Actions */}
          <Row className="flex flex-col sm:flex-row sm:justify-between">
            <Column>
              <Text>Keen for more?</Text>
            </Column>
            <Column>
              <Button
                href={`${process.env.NEXT_PUBLIC_SERVER_URL}/menu`}
                className="ml-2 flex h-9 items-center rounded-xl bg-[hsl(28,66%,70%)] px-4 py-2 text-white shadow hover:bg-secondary"
              >
                <Text className="ml-2">Have a look at our menu</Text>
              </Button>
            </Column>
          </Row>
        </Body>
      </Tailwind>
    </Html>
  );
}
