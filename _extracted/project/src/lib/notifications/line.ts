/**
 * LINE Messaging API client
 *
 * หมายเหตุสำคัญ: LINE Notify (บริการเดิมที่สเปคอ้างถึง) ปิดให้บริการแล้ว
 * ต้องใช้ LINE Messaging API ผ่าน LINE Official Account + Channel Access Token แทน
 */

interface LinePushMessageParams {
  channelAccessToken: string;
  to: string; // line_user_id หรือ group id
  text: string;
}

export async function pushLineMessage(
  params: LinePushMessageParams,
  fetchImpl: typeof fetch = fetch
): Promise<{ success: boolean; statusCode: number; error?: string }> {
  const { channelAccessToken, to, text } = params;

  if (!to) throw new Error('ต้องระบุ LINE user/group id ปลายทาง');
  if (!text) throw new Error('ต้องมีข้อความที่จะส่ง');

  try {
    const response = await fetchImpl('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        to,
        messages: [{ type: 'text', text }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return { success: false, statusCode: response.status, error: errorBody };
    }

    return { success: true, statusCode: response.status };
  } catch (err) {
    return {
      success: false,
      statusCode: 0,
      error: err instanceof Error ? err.message : 'unknown error',
    };
  }
}

/**
 * Retry with exponential backoff — ตามที่ design ระบุ (retry 3 ครั้ง)
 */
export async function pushLineMessageWithRetry(
  params: LinePushMessageParams,
  maxRetries = 3,
  fetchImpl: typeof fetch = fetch
): Promise<{ success: boolean; attempts: number; lastError?: string }> {
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await pushLineMessage(params, fetchImpl);
    if (result.success) {
      return { success: true, attempts: attempt };
    }
    lastError = result.error;

    if (attempt < maxRetries) {
      const backoffMs = 2 ** attempt * 500; // 1s, 2s, 4s
      await sleep(backoffMs);
    }
  }

  return { success: false, attempts: maxRetries, lastError };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
