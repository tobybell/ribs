
const useStream = _ => {
  const handlers = new Set();
  const stream = h => (handlers.add(h), () => handlers.delete(h));
  const emit = x => handlers.forEach(h => h(x));
  return [stream, emit];
};

const useState = initialValue => {
  const ref = { value: initialValue };
  const [value, emitValue] = useStream();
  const stream = h => (h(stream.value), value(h));
  stream.value = initialValue;
  const set = x => (ref.value = x);
};

const fromNowStream = time => {
  const [text, emitText] = useStream();
  const units = [
    { singular: 'year', plural: 'years', ms: 31536000000 },
    { singular: 'month', plural: 'months', ms: 2628000000 },
    { singular: 'week', plural: 'weeks', ms: 604800000 },
    { singular: 'day', plural: 'days', ms: 86400000 },
    { singular: 'hour', plural: 'hours', ms: 3600000 },
    { singular: 'minute', plural: 'minutes', ms: 60000 },
    { singular: 'second', plural: 'seconds', ms: 1000 },
    { singular: 'millisecond', plural: 'milliseconds', ms: 1 },
  ];
  const enable = _ => {
    // Find the next change point and 
    let d = time - Date.now();
    let i = 0;
    let nextTime = d;
    const updateAgo = _ => {
      // Find the smallest unit for which d is less than max.
      for (; nextTime >= units[i - 1].ms; i -= 1);
      const int = Math.floor(nextTime / units[i].ms);
      console.log(`${int} ${int === 1 ? units[i].singular : units[i].plural} ago`);
      nextTime = (int + 1) * units[i].ms;
      let now = Date.now();
      if (time + nextTime - now < 30)
        nextTime = now - time + 30;
      setTimeout(updateAgo, time + nextTime - Date.now());
    };
    const update = _ => {
      if (nextTime == 0) {
        console.log('now');
        nextTime = 30;
        i = units.length - 1;
        return updateAgo();
      }
      if (nextTime < 0) {
        nextTime *= -1;
        i = units.length - 1;
        return updateAgo();
      }
      // Find the biggest unit for which d is greater.
      for (; i < units.length - 1 && nextTime <= units[i].ms; i += 1);
      const int = Math.ceil(nextTime / units[i].ms) - 1;
      console.log(`${int} ${int === 1 ? units[i].singular : units[i].plural} from now`);
      nextTime = int * units[i].ms;
      let now = Date.now();
      if (time - nextTime - now < 30)
        nextTime = time - now - 30;
      setTimeout(update, time - nextTime - Date.now());
    };
    update();
  };
  return enable;
};

const target = Date.now() + 2;//new Date('2021-08-22').getTime();//;.now() + 10000;

const s = fromNowStream(target);
s(console.log);
