import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2022-11-15',
});

export async function POST(req) {
    const { amount, currency, paymentMethodId } = await req.json();

    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency,
            payment_method: paymentMethodId,
            confirm: true,
        });

        return NextResponse.json({ success: true, paymentIntent });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
}