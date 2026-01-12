# FreightClear Payments - Standalone Payment Processing System

A secure, PCI-compliant payment processing application powered by Authorize.Net. This standalone application provides a complete payment solution that can be deployed independently.

## Features

- **Secure Credit Card Processing** - PCI-compliant using Authorize.Net Accept.js
- **Service Fee Calculation** - Automatic 3.5% service fee with clear disclosure
- **User Authentication** - Secure login and registration system
- **Payment History** - View past transactions with detailed records
- **Production Ready** - Uses Authorize.Net production environment
- **Responsive Design** - Works on desktop and mobile devices

## Security Features

- Credit card data is tokenized client-side using Accept.js
- Card numbers never touch your server (PCI SAQ-A compliant)
- All transactions processed through Authorize.Net's secure infrastructure
- Passwords hashed with bcrypt
- Session-based authentication

## Quick Start

### 1. Create a New Replit Project

1. Go to [Replit](https://replit.com) and create a new **Node.js** project
2. Delete the default files

### 2. Copy Project Files

Copy all files from this `standalone-payment-app` directory to your new Replit project:

```
standalone-payment-app/
├── client/
│   └── src/
│       ├── components/
│       │   └── PaymentForm.tsx
│       ├── pages/
│       │   ├── History.tsx
│       │   ├── Login.tsx
│       │   ├── Register.tsx
│       │   └── Success.tsx
│       ├── App.tsx
│       ├── index.css
│       └── main.tsx
├── server/
│   ├── index.ts
│   ├── routes.ts
│   └── storage.ts
├── shared/
│   └── schema.ts
├── drizzle.config.ts
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

### 3. Add a PostgreSQL Database

1. In your Replit project, go to **Tools** → **Database**
2. Click **Create Database** and select **PostgreSQL**
3. Replit will automatically set the `DATABASE_URL` environment variable

### 4. Configure Secrets

Add the following secrets in your Replit project (**Tools** → **Secrets**):

| Secret Name | Description |
|-------------|-------------|
| `AUTHORIZE_NET_API_LOGIN_ID` | Your Authorize.Net API Login ID |
| `AUTHORIZE_NET_TRANSACTION_KEY` | Your Authorize.Net Transaction Key |
| `AUTHORIZE_NET_CLIENT_KEY` | Your Authorize.Net Public Client Key |
| `SESSION_SECRET` | A random string for session encryption (generate one) |

#### Getting Authorize.Net Credentials

1. Log in to your [Authorize.Net Merchant Interface](https://account.authorize.net/)
2. Go to **Account** → **API Credentials & Keys**
3. Copy your **API Login ID**
4. Generate a new **Transaction Key** (keep this secret!)
5. Generate a new **Public Client Key** for Accept.js

### 5. Install Dependencies

Run in the Replit shell:

```bash
npm install
```

### 6. Initialize Database

Run the database migration:

```bash
npm run db:push
```

### 7. Start the Application

Click **Run** or execute:

```bash
npm run dev
```

The application will be available at your Replit URL.

## Usage

### For Customers

1. **Register** - Create an account with email and password
2. **Login** - Sign in to your account
3. **Make Payment** - Enter payment amount, card details, and billing information
4. **View History** - Check your past transactions

### For Administrators

To create an admin account, update the database directly:

```sql
UPDATE users SET is_admin = true WHERE email = 'admin@example.com';
```

Admins can view all transactions across all users.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (auto-set by Replit) |
| `AUTHORIZE_NET_API_LOGIN_ID` | Yes | Authorize.Net API Login ID |
| `AUTHORIZE_NET_TRANSACTION_KEY` | Yes | Authorize.Net Transaction Key |
| `AUTHORIZE_NET_CLIENT_KEY` | Yes | Authorize.Net Public Client Key |
| `SESSION_SECRET` | Yes | Session encryption key |
| `NODE_ENV` | No | Set to "production" for production builds |
| `PORT` | No | Server port (default: 5000) |

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/register` | POST | No | Register new user |
| `/api/auth/login` | POST | No | Login user |
| `/api/auth/logout` | POST | Yes | Logout user |
| `/api/auth/user` | GET | Yes | Get current user |
| `/api/payment/config` | GET | No | Get payment configuration |
| `/api/payment/process` | POST | Yes | Process a payment |
| `/api/payment/history` | GET | Yes | Get payment history |
| `/api/payment/transaction/:id` | GET | Yes | Get specific transaction |
| `/api/admin/transactions` | GET | Admin | Get all transactions |

## Customization

### Service Fee Rate

Edit `server/routes.ts` line 127 to change the service fee rate:

```typescript
serviceFeeRate: 0.035, // Change to your desired rate
```

Also update the frontend display in `client/src/components/PaymentForm.tsx`.

### Company Branding

Update the company name in:
- `server/routes.ts` - `companyName` in payment config
- `client/src/App.tsx` - Navigation header
- `index.html` - Page title

### Styling

Modify `client/src/index.css` and use Tailwind CSS classes in components.

## Troubleshooting

### Payment Processing Errors

1. **E00027 - Invalid Authentication**: Check your API Login ID and Transaction Key
2. **Accept.js not loading**: Ensure you're using the production Accept.js URL
3. **CORS errors**: Verify your Replit domain is not blocked

### Database Issues

1. Ensure PostgreSQL database is created in Replit
2. Run `npm run db:push` to sync schema
3. Check DATABASE_URL is set correctly

### Session Issues

1. Ensure SESSION_SECRET is set
2. Clear browser cookies and try again
3. Check server logs for session errors

## Data Privacy

This application:
- **Does NOT** store raw credit card numbers
- **Does NOT** share data with AI services
- **Does** store transaction records (transaction ID, amount, last 4 digits)
- **Does** use Authorize.Net for payment processing only

## Support

For Authorize.Net support: [https://support.authorize.net/](https://support.authorize.net/)

## License

This application is provided as-is for payment processing purposes.
