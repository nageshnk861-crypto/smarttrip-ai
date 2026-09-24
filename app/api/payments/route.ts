import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripeKey = process.env.STRIPE_SECRET_KEY ?? '';
const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: '2020-08-27' }) : null;

export async function POST(req: NextRequest) {
  const { amount, currency, paymentMethodId } = await req.json();

  if (!stripe) {
    return NextResponse.json({ success: false, error: 'Stripe is not configured.' }, { status: 400 });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      payment_method: paymentMethodId,
      confirm: true,
    });

    return NextResponse.json({ success: true, paymentIntent });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payment failed';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}