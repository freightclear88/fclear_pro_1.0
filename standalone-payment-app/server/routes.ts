import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import bcrypt from "bcrypt";

declare module "express-session" {
  interface SessionData {
    userId?: number;
    isAdmin?: boolean;
  }
}

const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.session?.userId) {
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
};

const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.session?.userId && req.session?.isAdmin) {
    return next();
  }
  return res.status(403).json({ message: "Admin access required" });
};

export function registerRoutes(app: Express) {
  
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, firstName, lastName, companyName, phone } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }
      
      const user = await storage.createUser({
        email,
        password,
        firstName,
        lastName,
        companyName,
        phone,
        isAdmin: false,
      });
      
      req.session.userId = user.id;
      req.session.isAdmin = user.isAdmin || false;
      
      res.json({ success: true, user: { ...user, password: undefined } });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      req.session.userId = user.id;
      req.session.isAdmin = user.isAdmin || false;
      
      res.json({ success: true, user: { ...user, password: undefined } });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ success: true });
    });
  });

  app.get("/api/auth/user", isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ ...user, password: undefined });
    } catch (error) {
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  app.get("/api/payment/config", async (req, res) => {
    try {
      const apiLoginId = process.env.AUTHORIZE_NET_API_LOGIN_ID;
      const clientKey = process.env.AUTHORIZE_NET_CLIENT_KEY;
      
      if (!apiLoginId || !clientKey) {
        return res.status(500).json({ 
          success: false, 
          message: "Payment configuration not set" 
        });
      }
      
      res.json({
        success: true,
        apiLoginId,
        clientKey,
        environment: "production",
        serviceFeeRate: 0.035,
        companyName: "FreightClear Payments",
      });
    } catch (error) {
      console.error("Payment config error:", error);
      res.status(500).json({ success: false, message: "Failed to load payment configuration" });
    }
  });

  app.post("/api/payment/process", isAuthenticated, async (req, res) => {
    try {
      const { 
        opaqueData,
        amount,
        serviceFee,
        totalAmount,
        invoiceNumber,
        description,
        billingAddress,
        cardholderName
      } = req.body;
      
      if (!opaqueData || !amount) {
        return res.status(400).json({ message: "Missing required payment data" });
      }
      
      const ApiContracts = (await import("authorizenet")).APIContracts;
      const ApiControllers = (await import("authorizenet")).APIControllers;
      const SDKConstants = (await import("authorizenet")).Constants;
      
      const merchantAuth = new ApiContracts.MerchantAuthenticationType();
      merchantAuth.setName(process.env.AUTHORIZE_NET_API_LOGIN_ID);
      merchantAuth.setTransactionKey(process.env.AUTHORIZE_NET_TRANSACTION_KEY);
      
      const opaqueDataType = new ApiContracts.OpaqueDataType();
      opaqueDataType.setDataDescriptor(opaqueData.dataDescriptor);
      opaqueDataType.setDataValue(opaqueData.dataValue);
      
      const paymentType = new ApiContracts.PaymentType();
      paymentType.setOpaqueData(opaqueDataType);
      
      const orderDetails = new ApiContracts.OrderType();
      orderDetails.setInvoiceNumber(invoiceNumber || `INV-${Date.now()}`);
      orderDetails.setDescription(description || "Payment");
      
      const billTo = new ApiContracts.CustomerAddressType();
      billTo.setFirstName(billingAddress?.firstName || "");
      billTo.setLastName(billingAddress?.lastName || "");
      billTo.setCompany(billingAddress?.company || "");
      billTo.setAddress(billingAddress?.address || "");
      billTo.setCity(billingAddress?.city || "");
      billTo.setState(billingAddress?.state || "");
      billTo.setZip(billingAddress?.zip || "");
      billTo.setCountry(billingAddress?.country || "US");
      billTo.setPhoneNumber(billingAddress?.phone || "");
      
      const customerEmail = new ApiContracts.CustomerDataType();
      customerEmail.setEmail(billingAddress?.email || "");
      
      const transactionRequest = new ApiContracts.TransactionRequestType();
      transactionRequest.setTransactionType(ApiContracts.TransactionTypeEnum.AUTHCAPTURETRANSACTION);
      transactionRequest.setPayment(paymentType);
      transactionRequest.setAmount(parseFloat(totalAmount));
      transactionRequest.setOrder(orderDetails);
      transactionRequest.setBillTo(billTo);
      transactionRequest.setCustomer(customerEmail);
      
      const createRequest = new ApiContracts.CreateTransactionRequest();
      createRequest.setMerchantAuthentication(merchantAuth);
      createRequest.setTransactionRequest(transactionRequest);
      
      const ctrl = new ApiControllers.CreateTransactionController(createRequest.getJSON());
      ctrl.setEnvironment(SDKConstants.endpoint.production);
      
      ctrl.execute(async () => {
        const apiResponse = ctrl.getResponse();
        const response = new ApiContracts.CreateTransactionResponse(apiResponse);
        
        if (response && response.getMessages().getResultCode() === ApiContracts.MessageTypeEnum.OK) {
          const transactionResponse = response.getTransactionResponse();
          
          if (transactionResponse && transactionResponse.getMessages()) {
            const transactionId = transactionResponse.getTransId();
            const authCode = transactionResponse.getAuthCode();
            
            await storage.createTransaction({
              userId: req.session.userId!,
              transactionId,
              authCode,
              responseCode: transactionResponse.getResponseCode(),
              invoiceNumber,
              description,
              amount: parseFloat(amount),
              serviceFee: parseFloat(serviceFee || 0),
              totalAmount: parseFloat(totalAmount),
              serviceFeeRate: 0.035,
              cardType: transactionResponse.getAccountType(),
              cardLastFour: transactionResponse.getAccountNumber()?.slice(-4),
              cardholderName,
              billingFirstName: billingAddress?.firstName,
              billingLastName: billingAddress?.lastName,
              billingCompany: billingAddress?.company,
              billingAddress: billingAddress?.address,
              billingCity: billingAddress?.city,
              billingState: billingAddress?.state,
              billingZip: billingAddress?.zip,
              billingCountry: billingAddress?.country,
              billingPhone: billingAddress?.phone,
              billingEmail: billingAddress?.email,
              status: "approved",
              environment: "production",
            });
            
            return res.json({
              success: true,
              transactionId,
              authCode,
              message: "Payment processed successfully",
              amount: parseFloat(totalAmount),
            });
          }
        }
        
        const errorMessage = response?.getTransactionResponse()?.getErrors()?.getError()?.[0]?.getErrorText() 
          || "Payment processing failed";
        
        res.status(400).json({ success: false, message: errorMessage });
      });
      
    } catch (error) {
      console.error("Payment processing error:", error);
      res.status(500).json({ success: false, message: "Payment processing failed" });
    }
  });

  app.get("/api/payment/history", isAuthenticated, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      let transactions;
      if (req.session.isAdmin) {
        transactions = await storage.getAllTransactions(limit, offset);
      } else {
        transactions = await storage.getTransactionsByUserId(req.session.userId!, limit, offset);
      }
      
      res.json({ success: true, transactions });
    } catch (error) {
      console.error("Payment history error:", error);
      res.status(500).json({ success: false, message: "Failed to fetch payment history" });
    }
  });

  app.get("/api/payment/transaction/:id", isAuthenticated, async (req, res) => {
    try {
      const transaction = await storage.getTransactionById(parseInt(req.params.id));
      
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      if (!req.session.isAdmin && transaction.userId !== req.session.userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json({ success: true, transaction });
    } catch (error) {
      res.status(500).json({ success: false, message: "Failed to fetch transaction" });
    }
  });

  app.get("/api/admin/transactions", isAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const transactions = await storage.getAllTransactions(limit, offset);
      res.json({ success: true, transactions });
    } catch (error) {
      res.status(500).json({ success: false, message: "Failed to fetch transactions" });
    }
  });
}
