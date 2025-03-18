import { Resend } from "resend";

const resend = new Resend("re_Xowno813_2j7dvHxHpb7uzT6ez62rg8Mf");

resend.emails.send({
  from: "onboarding@resend.dev",
  to: "eversweet@eversweet.co.nz",
  subject: "Hello World",
  html: "<p>Congrats on sending your <strong>first email</strong>!</p>",
});
