import type { Book, Example, Word } from "../types/models";

export const SEED_BOOK_ID = "local-demo";

export const SEED_BOOK: Book = {
  id: SEED_BOOK_ID,
  name: "本地词书 · 核心词汇",
  source: "local",
  total: 0,
  active: 1,
};

interface Seed {
  w: string;
  ph: string;
  pos: string;
  m: string[];
  ex?: [string, string];
}

// 开箱即用的示例词表（原创整理）。更多词汇可在「单词书」页面导入 CSV。
const SEEDS: Seed[] = [
  { w: "abandon", ph: "/əˈbændən/", pos: "v.", m: ["放弃，抛弃", "中止"], ex: ["He abandoned the plan at the last minute.", "他在最后一刻放弃了计划。"] },
  { w: "ability", ph: "/əˈbɪləti/", pos: "n.", m: ["能力，才能"], ex: ["She has the ability to solve hard problems.", "她有解决难题的能力。"] },
  { w: "absorb", ph: "/əbˈzɔːb/", pos: "v.", m: ["吸收", "使专注"], ex: ["Plants absorb water through their roots.", "植物通过根部吸收水分。"] },
  { w: "achieve", ph: "/əˈtʃiːv/", pos: "v.", m: ["达到，实现"], ex: ["You can achieve your goal step by step.", "你可以一步步实现目标。"] },
  { w: "ancient", ph: "/ˈeɪnʃənt/", pos: "adj.", m: ["古代的，古老的"], ex: ["We visited an ancient temple.", "我们参观了一座古庙。"] },
  { w: "anxious", ph: "/ˈæŋkʃəs/", pos: "adj.", m: ["焦虑的", "渴望的"], ex: ["He felt anxious before the exam.", "考试前他感到焦虑。"] },
  { w: "apparent", ph: "/əˈpærənt/", pos: "adj.", m: ["明显的", "表面上的"] },
  { w: "appreciate", ph: "/əˈpriːʃieɪt/", pos: "v.", m: ["感激", "欣赏，重视"], ex: ["I really appreciate your help.", "我非常感激你的帮助。"] },
  { w: "approach", ph: "/əˈprəʊtʃ/", pos: "v./n.", m: ["接近；方法", "途径"], ex: ["We need a new approach to this problem.", "我们需要新方法来解决这个问题。"] },
  { w: "avoid", ph: "/əˈvɔɪd/", pos: "v.", m: ["避免，避开"], ex: ["Try to avoid making the same mistake.", "尽量避免犯同样的错误。"] },
  { w: "balance", ph: "/ˈbæləns/", pos: "n./v.", m: ["平衡", "余额"], ex: ["Keep a balance between work and rest.", "在工作和休息之间保持平衡。"] },
  { w: "benefit", ph: "/ˈbenɪfɪt/", pos: "n./v.", m: ["好处，益处", "受益"], ex: ["Exercise benefits both body and mind.", "锻炼对身心都有好处。"] },
  { w: "brilliant", ph: "/ˈbrɪliənt/", pos: "adj.", m: ["聪明的，杰出的", "明亮的"] },
  { w: "calm", ph: "/kɑːm/", pos: "adj./v.", m: ["平静的", "使冷静"], ex: ["Try to stay calm during the interview.", "面试时尽量保持冷静。"] },
  { w: "capable", ph: "/ˈkeɪpəbl/", pos: "adj.", m: ["有能力的"], ex: ["She is capable of finishing it alone.", "她有能力独自完成。"] },
  { w: "challenge", ph: "/ˈtʃælɪndʒ/", pos: "n./v.", m: ["挑战", "向…挑战"], ex: ["Learning a language is a big challenge.", "学一门语言是个大挑战。"] },
  { w: "comfortable", ph: "/ˈkʌmftəbl/", pos: "adj.", m: ["舒适的，舒服的"], ex: ["This chair is very comfortable.", "这把椅子非常舒适。"] },
  { w: "communicate", ph: "/kəˈmjuːnɪkeɪt/", pos: "v.", m: ["交流，沟通"], ex: ["We communicate mostly by email.", "我们主要通过邮件沟通。"] },
  { w: "concentrate", ph: "/ˈkɒnsntreɪt/", pos: "v.", m: ["集中，专心"], ex: ["I can't concentrate with all this noise.", "这么吵我无法集中注意力。"] },
  { w: "confident", ph: "/ˈkɒnfɪdənt/", pos: "adj.", m: ["自信的，确信的"], ex: ["He is confident about the future.", "他对未来充满信心。"] },
  { w: "curious", ph: "/ˈkjʊəriəs/", pos: "adj.", m: ["好奇的", "奇怪的"], ex: ["Children are curious about everything.", "孩子对一切都好奇。"] },
  { w: "decide", ph: "/dɪˈsaɪd/", pos: "v.", m: ["决定，下决心"], ex: ["They decided to walk home.", "他们决定走回家。"] },
  { w: "describe", ph: "/dɪˈskraɪb/", pos: "v.", m: ["描述，形容"], ex: ["Can you describe what you saw?", "你能描述一下看到的东西吗？"] },
  { w: "develop", ph: "/dɪˈveləp/", pos: "v.", m: ["发展，开发", "养成"], ex: ["Reading helps develop your mind.", "阅读有助于开发思维。"] },
  { w: "efficient", ph: "/ɪˈfɪʃnt/", pos: "adj.", m: ["高效的"], ex: ["This is a more efficient way to work.", "这是一种更高效的工作方式。"] },
  { w: "encourage", ph: "/ɪnˈkʌrɪdʒ/", pos: "v.", m: ["鼓励，激励"], ex: ["Teachers should encourage questions.", "老师应该鼓励提问。"] },
  { w: "environment", ph: "/ɪnˈvaɪrənmənt/", pos: "n.", m: ["环境"], ex: ["We must protect the environment.", "我们必须保护环境。"] },
  { w: "especially", ph: "/ɪˈspeʃəli/", pos: "adv.", m: ["尤其，特别"], ex: ["I like fruit, especially apples.", "我喜欢水果，尤其是苹果。"] },
  { w: "eventually", ph: "/ɪˈventʃuəli/", pos: "adv.", m: ["最终，终于"], ex: ["He eventually passed the exam.", "他最终通过了考试。"] },
  { w: "familiar", ph: "/fəˈmɪliə/", pos: "adj.", m: ["熟悉的"], ex: ["Her face looks familiar.", "她的脸看起来很熟悉。"] },
  { w: "frequent", ph: "/ˈfriːkwənt/", pos: "adj.", m: ["频繁的，常见的"], ex: ["Buses make frequent stops here.", "公交车在这里频繁停靠。"] },
  { w: "grateful", ph: "/ˈɡreɪtfl/", pos: "adj.", m: ["感激的，感谢的"], ex: ["I'm grateful for your support.", "我感激你的支持。"] },
  { w: "imagine", ph: "/ɪˈmædʒɪn/", pos: "v.", m: ["想象，设想"], ex: ["Imagine living on an island.", "想象住在一座岛上。"] },
  { w: "improve", ph: "/ɪmˈpruːv/", pos: "v.", m: ["改善，提高"], ex: ["Practice can improve your memory.", "练习能提高记忆力。"] },
  { w: "influence", ph: "/ˈɪnfluəns/", pos: "n./v.", m: ["影响", "影响力"] },
  { w: "knowledge", ph: "/ˈnɒlɪdʒ/", pos: "n.", m: ["知识，了解"], ex: ["Knowledge comes from practice.", "知识来自实践。"] },
  { w: "necessary", ph: "/ˈnesəsəri/", pos: "adj.", m: ["必要的，必需的"], ex: ["Sleep is necessary for health.", "睡眠对健康是必需的。"] },
  { w: "opportunity", ph: "/ˌɒpəˈtjuːnəti/", pos: "n.", m: ["机会，时机"], ex: ["Don't miss this opportunity.", "不要错过这个机会。"] },
  { w: "patient", ph: "/ˈpeɪʃnt/", pos: "adj./n.", m: ["耐心的", "病人"], ex: ["Be patient with yourself.", "对自己耐心一点。"] },
  { w: "possible", ph: "/ˈpɒsəbl/", pos: "adj.", m: ["可能的"], ex: ["It's possible to finish today.", "今天完成是可能的。"] },
  { w: "practice", ph: "/ˈpræktɪs/", pos: "n./v.", m: ["练习", "实践"], ex: ["Practice makes perfect.", "熟能生巧。"] },
  { w: "progress", ph: "/ˈprəʊɡres/", pos: "n./v.", m: ["进步，进展"], ex: ["You're making great progress.", "你正在取得很大进步。"] },
  { w: "recognize", ph: "/ˈrekəɡnaɪz/", pos: "v.", m: ["认出，认可"], ex: ["I recognized her voice at once.", "我立刻听出了她的声音。"] },
  { w: "remember", ph: "/rɪˈmembə/", pos: "v.", m: ["记得，记住"], ex: ["I remember meeting him before.", "我记得以前见过他。"] },
  { w: "succeed", ph: "/səkˈsiːd/", pos: "v.", m: ["成功，达到目的"], ex: ["Work hard and you will succeed.", "努力工作你就会成功。"] },
  { w: "support", ph: "/səˈpɔːt/", pos: "v./n.", m: ["支持", "支撑"], ex: ["My family always supports me.", "我的家人一直支持我。"] },
  { w: "understand", ph: "/ˌʌndəˈstænd/", pos: "v.", m: ["理解，明白"], ex: ["I don't quite understand this word.", "我不太理解这个单词。"] },
];

export function seedWords(): Word[] {
  return SEEDS.map((s) => {
    const examples: Example[] = s.ex ? [{ en: s.ex[0], zh: s.ex[1] }] : [];
    return {
      id: `seed-${s.w}`,
      bookId: SEED_BOOK_ID,
      word: s.w,
      phonetic: s.ph,
      pos: s.pos,
      meanings: s.m,
      examples,
      audioUrl: null,
      source: "local",
    };
  });
}
