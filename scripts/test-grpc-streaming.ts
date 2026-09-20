import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { join } from 'path';

const ORDER_PROTO_PATH = join(__dirname, '../libs/shared/src/proto/order/order.proto');

const packageDefinition = protoLoader.loadSync(ORDER_PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
  includeDirs: [join(__dirname, '../libs/shared/src/proto')],
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
const orderPackage = protoDescriptor.order;

const client = new orderPackage.OrderService('localhost:5003', grpc.credentials.createInsecure());

async function runClientStreamingTest(): Promise<string> {
  console.log('\n======================================================');
  console.log('1. TESTING CLIENT STREAMING (CreateOrderStream)');
  console.log('======================================================');

  return new Promise((resolve, reject) => {
    const idempotencyKey = `idemp-${Date.now()}`;
    const call = client.CreateOrderStream((err: any, response: any) => {
      if (err) {
        console.error('Client Streaming Error:', err);
        return reject(err);
      }
      console.log('>>> Server Response received:', JSON.stringify(response, null, 2));
      resolve(response.order_id);
    });

    console.log('-> Sending Chunk 1: Metadata');
    call.write({
      idempotency_key: idempotencyKey,
      metadata_chunk: { currency: 'USD', note: 'E2E Streaming Test Order', tags: { priority: 'HIGH' } },
    });

    console.log('-> Sending Chunk 2: Customer Info');
    call.write({
      idempotency_key: idempotencyKey,
      customer_chunk: { customer_id: 'cust-1001', shipping_address: '123 Tech Blvd', billing_address: '123 Tech Blvd' },
    });

    console.log('-> Sending Chunk 3: Order Item #1');
    call.write({
      idempotency_key: idempotencyKey,
      item_chunk: { product_id: 'prod-macbook', sku: 'MBP-M3-16', quantity: 1, unit_price: 1999.99 },
    });

    console.log('-> Sending Chunk 4: Order Item #2');
    call.write({
      idempotency_key: idempotencyKey,
      item_chunk: { product_id: 'prod-mouse', sku: 'MX-MASTER-3S', quantity: 2, unit_price: 99.99 },
    });

    console.log('-> Sending Chunk 5: Payment Info');
    call.write({
      idempotency_key: idempotencyKey,
      payment_chunk: { payment_method: 'CREDIT_CARD', transaction_token: 'tok_visa_streaming', amount: 2199.97 },
    });

    console.log('-> Ending Client Stream...');
    call.end();
  });
}

async function runServerStreamingTest(orderId: string): Promise<void> {
  console.log('\n======================================================');
  console.log(`2. TESTING SERVER STREAMING (GetOrderEventsStream) for Order ID: ${orderId}`);
  console.log('======================================================');

  return new Promise((resolve, reject) => {
    const call = client.GetOrderEventsStream({ order_id: orderId, include_historical: true });

    call.on('data', (event: any) => {
      console.log('<<< Streamed Event Received:', JSON.stringify(event));
    });

    call.on('end', () => {
      console.log('>>> Server Stream Completed cleanly.');
      resolve();
    });

    call.on('error', (err: any) => {
      console.error('Server Streaming Error:', err);
      reject(err);
    });
  });
}

async function runBidirectionalStreamingTest(): Promise<void> {
  console.log('\n======================================================');
  console.log('3. TESTING BIDIRECTIONAL STREAMING (OrderProcessingSession)');
  console.log('======================================================');

  return new Promise((resolve, reject) => {
    const call = client.OrderProcessingSession();
    const sessionId = `sess-${Date.now()}`;

    call.on('data', (event: any) => {
      console.log('<<< BiDi Event Received from Server:', JSON.stringify(event));
    });

    call.on('end', () => {
      console.log('>>> BiDi Stream Closed by Server.');
      resolve();
    });

    call.on('error', (err: any) => {
      console.error('BiDi Stream Error:', err);
      reject(err);
    });

    console.log('-> Sending Cmd 1: CMD_START_SESSION');
    call.write({ session_id: sessionId, command_type: 'CMD_START_SESSION' });

    setTimeout(() => {
      console.log('-> Sending Cmd 2: CMD_UPDATE_QUANTITY (qty = 4)');
      call.write({ session_id: sessionId, command_type: 'CMD_UPDATE_QUANTITY', new_quantity: 4 });
    }, 500);

    setTimeout(() => {
      console.log('-> Sending Cmd 3: CMD_APPLY_COUPON (coupon = SAVE20)');
      call.write({ session_id: sessionId, command_type: 'CMD_APPLY_COUPON', coupon_code: 'SAVE20' });
    }, 1000);

    setTimeout(() => {
      console.log('-> Sending Cmd 4: CMD_CONFIRM_PAYMENT');
      call.write({ session_id: sessionId, command_type: 'CMD_CONFIRM_PAYMENT' });
    }, 1500);

    setTimeout(() => {
      console.log('-> Sending Cmd 5: CMD_CANCEL_ORDER & Ending Stream');
      call.write({ session_id: sessionId, command_type: 'CMD_CANCEL_ORDER' });
      call.end();
    }, 2000);
  });
}

async function main() {
  try {
    const createdOrderId = await runClientStreamingTest();
    await runServerStreamingTest(createdOrderId);
    await runBidirectionalStreamingTest();
    console.log('\n======================================================');
    console.log('SUCCESS: All 3 gRPC Streaming RPCs verified successfully!');
    console.log('======================================================\n');
  } catch (err) {
    console.error('Test execution failed:', err);
  }
}

main();
