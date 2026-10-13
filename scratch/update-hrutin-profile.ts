import { db } from "../src/database/db";

async function main() {
  console.log("Updating Hrutin Nammi profile and answers in database...");

  await db.query(`
    UPDATE public.user_profiles
    SET first_name = 'Hrutin',
        last_name = 'Nammi',
        phone = '8688423267',
        location = 'Vadodara, Gujarat, India'
    WHERE user_id = 'usr_hrutin_nammi' OR first_name ILIKE '%hrutin%'
  `);

  const answersToUpdate: Record<string, string> = {
    name: "Hrutin Nammi",
    full_name: "Hrutin Nammi",
    first_name: "Hrutin",
    last_name: "Nammi",
    legal_name: "Hrutin Nammi",
    legal_last_name: "Nammi",
    phone: "8688423267",
    mobile: "8688423267",
  };

  for (const [k, v] of Object.entries(answersToUpdate)) {
    await db.query(`
      INSERT INTO public.user_saved_answers (id, user_id, question_key, answer_value)
      VALUES ($1, 'usr_hrutin_nammi', $2, $3)
      ON CONFLICT (user_id, question_key) DO UPDATE SET answer_value = EXCLUDED.answer_value
    `, [`ans_hrutin_${k}`, k, v]);
  }

  const check = await db.query("SELECT user_id, first_name, last_name, phone FROM public.user_profiles WHERE user_id = 'usr_hrutin_nammi'");
  console.log("Updated Profile in DB:", check.rows);

  await db.close();
}

main().catch(async (e) => {
  console.error("Error updating profile:", e);
  await db.close();
});
