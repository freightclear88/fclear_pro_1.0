import ApiContracts from "authorizenet/lib/apicontracts.js";
import ApiControllers from "authorizenet/lib/apicontrollers.js";
import SDKConstants from "authorizenet/lib/constants.js";
import { db } from "./db";
import { users } from "@shared/schema";
import { and, eq, isNotNull, lte } from "drizzle-orm";
import { storage } from "./storage";

/**
 * Check for active subscriptions whose nextBillingDate has passed and charge them
 * via the stored Authorize.Net customer/payment profile.
 *
 * Intended to be called by a cron job (e.g. daily at midnight).
 */
export async function checkAndChargeRenewals(): Promise<void> {
  const apiLoginId = process.env.AUTHORIZE_NET_API_LOGIN_ID;
  const transactionKey = process.env.AUTHORIZE_NET_TRANSACTION_KEY;

  if (!apiLoginId || !transactionKey) {
    console.error("[billing] Authorize.Net credentials not configured — skipping renewal run");
    return;
  }

  const now = new Date();

  const dueUsers = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.subscriptionStatus, "active"),
        lte(users.nextBillingDate, now),
        isNotNull(users.customerProfileId),
        isNotNull(users.paymentProfileId)
      )
    );

  console.log(`[billing] Found ${dueUsers.length} subscription(s) due for renewal`);

  for (const user of dueUsers) {
    try {
      await chargeRenewal(user, apiLoginId, transactionKey);
    } catch (err) {
      console.error(`[billing] Renewal failed for user ${user.id}:`, err);
    }
  }
}

async function chargeRenewal(
  user: Awaited<ReturnType<typeof db.select>>["0"] & typeof users.$inferSelect,
  apiLoginId: string,
  transactionKey: string
): Promise<void> {
  const amount = parseFloat(String(user.subscriptionAmount ?? "0"));
  if (amount <= 0) {
    console.warn(`[billing] Skipping user ${user.id}: subscription amount is $0`);
    return;
  }

  const merchantAuth = new ApiContracts.MerchantAuthenticationType();
  merchantAuth.setName(apiLoginId);
  merchantAuth.setTransactionKey(transactionKey);

  const profileToCharge = new ApiContracts.CustomerProfilePaymentType();
  profileToCharge.setCustomerProfileId(user.customerProfileId);

  const paymentProfile = new ApiContracts.PaymentProfileType();
  paymentProfile.setPaymentProfileId(user.paymentProfileId);
  profileToCharge.setPaymentProfile(paymentProfile);

  const txRequest = new ApiContracts.TransactionRequestType();
  txRequest.setTransactionType(ApiContracts.TransactionTypeEnum.AUTHCAPTURETRANSACTION);
  txRequest.setAmount(amount.toFixed(2));
  txRequest.setProfile(profileToCharge);
  txRequest.setLineItems([]);

  const createTxReq = new ApiContracts.CreateTransactionRequest();
  createTxReq.setMerchantAuthentication(merchantAuth);
  createTxReq.setTransactionRequest(txRequest);
  createTxReq.setRefId(`renewal-${user.id}-${Date.now()}`);

  const ctrl = new ApiControllers.CreateTransactionController(createTxReq.getJSON());

  if (process.env.NODE_ENV === "production") {
    ctrl.setEnvironment(SDKConstants.endpoint.production);
  } else {
    ctrl.setEnvironment(SDKConstants.endpoint.sandbox);
  }

  await new Promise<void>((resolve, reject) => {
    ctrl.execute(async () => {
      try {
        const apiResponse = ctrl.getResponse();
        const response = new ApiContracts.CreateTransactionResponse(apiResponse);

        if (response.getMessages().getResultCode() !== ApiContracts.MessageTypeEnum.OK) {
          const errText = response.getMessages().getMessage()[0].getText();
          const failCount = (user.paymentFailureCount ?? 0) + 1;
          await storage.updateUserSubscription(user.id, {
            paymentFailureCount: failCount,
            subscriptionStatus: failCount >= 3 ? "past_due" : "active",
          });
          return reject(new Error(`Authorize.Net error: ${errText}`));
        }

        const txResult = response.getTransactionResponse();

        if (!txResult || txResult.getResponseCode() !== "1") {
          const failCount = (user.paymentFailureCount ?? 0) + 1;
          await storage.updateUserSubscription(user.id, {
            paymentFailureCount: failCount,
            subscriptionStatus: failCount >= 3 ? "past_due" : "active",
          });
          return reject(new Error(`Transaction declined (code ${txResult?.getResponseCode()})`));
        }

        // Advance billing date by one period
        const nextBillingDate = new Date();
        if (user.billingCycle === "yearly") {
          nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
        } else {
          nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
        }

        await storage.updateUserSubscription(user.id, {
          nextBillingDate,
          subscriptionEndDate: new Date(nextBillingDate),
          lastPaymentDate: new Date(),
          paymentFailureCount: 0,
        });

        await storage.createPaymentTransaction({
          userId: user.id,
          transactionId: txResult.getTransId(),
          amount: amount.toString(),
          status: "success",
          paymentMethod: "credit_card",
          authCode: txResult.getAuthCode(),
          responseCode: txResult.getResponseCode(),
          description: `${user.subscriptionPlan ?? "pro"} plan renewal — ${user.billingCycle ?? "monthly"}`,
          billingCycle: user.billingCycle ?? "monthly",
          rawResponse: apiResponse,
        });

        console.log(`[billing] Renewal charged $${amount} for user ${user.id} (txId: ${txResult.getTransId()})`);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
}
