import { IconDescriptor, pathsIcon } from "./paths-icon";

const icons: { [key: string]: IconDescriptor } = {
  sidebarDesktopFolder: [18, 18, [
    [1, 'M0,8C0,5.792 1.792,4 4,4C4,4 32,4 32,4C34.208,4 36,5.792 36,8L36,28C36,30.208 34.208,32 32,32C32,32 4,32 4,32C1.792,32 0,30.208 0,28C0,28 0,8 0,8ZM32.013,30C33.107,29.993 33.993,29.106 34,28.013L34,10L2,10L2,28C2,29.104 2.896,30 4,30L32.013,30ZM34,8C34,6.9 33.111,6.007 32.013,6L4,6C2.896,6 2,6.896 2,8L34,8Z'],
    [.4, 'M32.013,30C33.107,29.993 33.993,29.106 34,28.013L34,10L2,10L2,28C2,29.104 2.896,30 4,30L8,30L8,25L9,24L27,24L28,25L28,30L32.013,30Z'],
    [.7, 'M9,30L8,30L8,25L9,24L27,24L28,25L28,30L27,30L27,30L9,30L9,30ZM14,29L14,25L10,25L10,29L14,29ZM20,29L20,25L16,25L16,29L20,29ZM26,29L26,25L22,25L22,29L26,29Z'],
  ]],
  sidebarGenericFolder: [18, 18, [
    [1, 'M13.414,6L34,6C35.104,6 36,6.896 36,8L36,30C36,31.104 35.104,32 34,32L2,32C0.896,32 0,31.104 0,30L0,5C0,3.896 0.896,3 2,3L10,3C10.256,3 10.512,3.098 10.707,3.293L13.414,6ZM34,30C34,30 34,30 34,30ZM3,12C2.448,12 2,12.448 2,13L2,30L34,30L34,13C34,12.448 33.552,12 33,12L3,12ZM34,10.171L34,8L13,8L13,8C12.744,8 12.488,7.902 12.293,7.707L9.586,5L2,5L2,10.171C2.313,10.06 2.649,10 3,10L33,10C33.351,10 33.687,10.06 34,10.171Z'],
    [.3, 'M34,13C34,12.735 33.895,12.48 33.707,12.293C33.52,12.105 33.265,12 33,12C28.225,12 7.775,12 3,12C2.735,12 2.48,12.105 2.293,12.293C2.105,12.48 2,12.735 2,13C2,16.782 2,30 2,30L34,30L34,13Z'],
    [.1, 'M33,10L3,10C2.66,10.001 2.324,10.058 2.003,10.17L2,10.171L2,5L9.586,5L12.293,7.707C12.488,7.902 12.744,8 13,8L13,8L34,8L34,10.171C33.687,10.06 33.351,10 33,10Z'],
  ]],
  sidebariCloud: [18, 18, [
    [.1, 'M7.8,28C7.8,28 28.5,28 28.5,28C31.536,28 34,25.536 34,22.5C34,19.802 32.053,17.554 29.488,17.088C28.963,16.993 28.497,16.691 28.195,16.25C27.893,15.809 27.78,15.266 27.882,14.741C27.959,14.339 28,13.924 28,13.5C28,9.913 25.087,7 21.5,7C18.785,7 16.457,8.668 15.485,11.033C15.232,11.647 14.692,12.096 14.042,12.231C13.392,12.366 12.717,12.17 12.241,11.707C11.791,11.27 11.177,11 10.5,11C9.12,11 8,12.12 8,13.5C8,13.702 8.024,13.898 8.069,14.087C8.195,14.609 8.105,15.16 7.82,15.615C7.534,16.071 7.078,16.392 6.553,16.507C3.949,17.079 2,19.407 2,22.186C2,25.394 4.598,28 7.8,28Z'],
    [1, 'M7.8,30C3.495,30 0,26.499 0,22.186C0,18.45 2.624,15.323 6.124,14.554C6.043,14.216 6,13.863 6,13.5C6,11.016 8.016,9 10.5,9C11.718,9 12.824,9.485 13.635,10.273C14.906,7.18 17.951,5 21.5,5C26.191,5 30,8.809 30,13.5C30,14.054 29.947,14.596 29.845,15.121C33.343,15.755 36,18.82 36,22.5C36,26.639 32.639,30 28.5,30L7.8,30ZM7.8,28C7.8,28 28.5,28 28.5,28C31.536,28 34,25.536 34,22.5C34,19.802 32.053,17.554 29.488,17.088C28.963,16.993 28.497,16.691 28.195,16.25C27.893,15.809 27.78,15.266 27.882,14.741C27.959,14.339 28,13.924 28,13.5C28,9.913 25.087,7 21.5,7C18.785,7 16.457,8.668 15.485,11.033C15.232,11.647 14.692,12.096 14.042,12.231C13.392,12.366 12.717,12.17 12.241,11.707C11.791,11.27 11.177,11 10.5,11C9.12,11 8,12.12 8,13.5C8,13.702 8.024,13.898 8.069,14.087C8.195,14.609 8.105,15.16 7.82,15.615C7.534,16.071 7.078,16.392 6.553,16.507C3.949,17.079 2,19.407 2,22.186C2,25.394 4.598,28 7.8,28Z'],
  ]],
  sidebarDocumentsFolder: [18, 18, [
    [.4, 'M20,3L14,3L14,7L24,17L24,27L32,27L32,15L30,13L22,13L22,5L20,3Z'],
    [.15, 'M22,21L20,19L12,19L12,11L10,9L4,9L4,33L22,33L22,21Z'],
    [1, 'M12,7L12,1L24,1L34,11L34,29L24,29L24,35L2,35L2,7L12,7ZM12,11L10,9L4,9L4,33L22,33L22,21L20,19L12,19L12,11ZM24,27L32,27L32,15L30,13L22,13L22,5L20,3L14,3L14,7L24,17L24,27ZM14,17L14,10L21,17L14,17ZM24,11L24,4L31,11L24,11Z'],
  ]],
  sidebarDownloadsFolder: [18, 18, [
    [1, 'M18,0C27.934,0 36,8.066 36,18C36,27.934 27.934,36 18,36C8.066,36 0,27.934 0,18C0,8.066 8.066,0 18,0ZM18,2C26.831,2 34,9.169 34,18C34,26.831 26.831,34 18,34C9.169,34 2,26.831 2,18C2,9.169 9.169,2 18,2Z'],
    [.9, 'M18,2C26.831,2 34,9.169 34,18C34,26.831 26.831,34 18,34C9.169,34 2,26.831 2,18C2,9.169 9.169,2 18,2ZM14,8L22,8L22,18L28,18L18,29L8,18L14,18L14,8Z'],
    [1, 'M12,16L12,8C12,6.895 12.895,6 14,6L22,6C23.105,6 24,6.895 24,8L24,16L28,16C28.792,16 29.509,16.467 29.829,17.191C30.149,17.915 30.012,18.76 29.48,19.345L19.48,30.345C19.101,30.762 18.563,31 18,31C17.437,31 16.899,30.762 16.52,30.345L6.52,19.345C5.988,18.76 5.851,17.915 6.171,17.191C6.491,16.467 7.208,16 8,16L12,16ZM14,8L22,8L22,18L28,18L18,29L8,18L14,18L14,8Z'],
  ]],
  sidebarMoviesFolder: [18, 18, [
    [1, 'M34,1L2,1L2,35L34,35L34,1ZM28,19L8,19L8,33L28,33L28,19ZM32,31L30,31L30,33L32,33L32,31ZM6,31L4,31L4,33L6,33L6,31ZM32,27L30,27L30,29L32,29L32,27ZM6,27L4,27L4,29L6,29L6,27ZM32,23L30,23L30,25L32,25L32,23ZM6,23L4,23L4,25L6,25L6,23ZM32,19L30,19L30,21L32,21L32,19ZM6,19L4,19L4,21L6,21L6,19ZM6,15L4,15L4,17L6,17L6,15ZM32,15L30,15L30,17L32,17L32,15ZM28,3L8,3L8,17L28,17L28,3ZM32,11L30,11L30,13L32,13L32,11ZM6,11L4,11L4,13L6,13L6,11ZM32,7L30,7L30,9L32,9L32,7ZM6,7L4,7L4,9L6,9L6,7ZM6,3L4,3L4,5L6,5L6,3ZM32,3L30,3L30,5L32,5L32,3Z'],
    [.2, 'M8,3L28,3L28,17,L8,17Z'],
    [.2, 'M8,19L28,19L28,33,L8,33Z'],
  ]],
  caretRight: [18, 18, [
    [1, 'M11,9L11,27L26,18L11,9Z'],
  ]],
  caretDown: [18, 18, [
    [1, 'M9,11L27,11L18,26L9,11Z'],
  ]],
  icons: [18, 18, [
    [1, 'M22,21C22,19.896 21.104,19 20,19L16,19C14.896,19 14,19.896 14,21L14,25C14,26.104 14.896,27 16,27L20,27C21.104,27 22,26.104 22,25L22,21ZM12,21C12,19.896 11.104,19 10,19L6,19C4.896,19 4,19.896 4,21L4,25C4,26.104 4.896,27 6,27L10,27C11.104,27 12,26.104 12,25L12,21ZM32,21C32,19.896 31.104,19 30,19L26,19C24.896,19 24,19.896 24,21L24,25C24,26.104 24.896,27 26,27L30,27C31.104,27 32,26.104 32,25L32,21ZM12,11C12,9.896 11.104,9 10,9L6,9C4.896,9 4,9.896 4,11L4,15C4,16.104 4.896,17 6,17L10,17C11.104,17 12,16.104 12,15L12,11ZM22,11C22,9.896 21.104,9 20,9L16,9C14.896,9 14,9.896 14,11L14,15C14,16.104 14.896,17 16,17L20,17C21.104,17 22,16.104 22,15L22,11ZM32,11C32,9.896 31.104,9 30,9L26,9C24.896,9 24,9.896 24,11L24,15C24,16.104 24.896,17 26,17L30,17C31.104,17 32,16.104 32,15L32,11Z'],
  ]],
  list: [18, 18, [
    [1, 'M32,26L4,26L4,28L32,28L32,26ZM32,20L4,20L4,22L32,22L32,20ZM32,14L4,14L4,16L32,16L32,14ZM32,8L4,8L4,10L32,10L32,8Z'],
  ]],
  columns: [18, 18, [
    [1, 'M34,10.5C34,9.12 32.88,8 31.5,8L4.5,8C3.12,8 2,9.12 2,10.5L2,25.5C2,26.88 3.12,28 4.5,28L31.5,28C32.88,28 34,26.88 34,25.5L34,10.5ZM12,10L12,26L4.5,26C4.224,26 4,25.776 4,25.5L4,10.5C4,10.224 4.224,10 4.5,10L12,10ZM24,10L31.5,10C31.776,10 32,10.224 32,10.5L32,25.5C32,25.776 31.776,26 31.5,26L24,26L24,10ZM22,10L14,10L14,26L22,26L22,10Z'],
  ]],
  gallery: [18, 18, [
    [.6, 'M30,10.5C30,10.224 29.776,10 29.5,10L6.5,10C6.224,10 6,10.224 6,10.5L6,19.5C6,19.776 6.224,20 6.5,20L29.5,20C29.776,20 30,19.776 30,19.5L30,10.5Z'],
    [1, 'M14,25.5C14,24.672 13.328,24 12.5,24L11.5,24C10.672,24 10,24.672 10,25.5L10,26.5C10,27.328 10.672,28 11.5,28L12.5,28C13.328,28 14,27.328 14,26.5L14,25.5ZM20,25.5C20,24.672 19.328,24 18.5,24L17.5,24C16.672,24 16,24.672 16,25.5L16,26.5C16,27.328 16.672,28 17.5,28L18.5,28C19.328,28 20,27.328 20,26.5L20,25.5ZM26,25.5C26,24.672 25.328,24 24.5,24L23.5,24C22.672,24 22,24.672 22,25.5L22,26.5C22,27.328 22.672,28 23.5,28L24.5,28C25.328,28 26,27.328 26,26.5L26,25.5ZM32,25.5C32,24.672 31.328,24 30.5,24L29.5,24C28.672,24 28,24.672 28,25.5L28,26.5C28,27.328 28.672,28 29.5,28L30.5,28C31.328,28 32,27.328 32,26.5L32,25.5ZM8,25.5C8,24.672 7.328,24 6.5,24L5.5,24C4.672,24 4,24.672 4,25.5L4,26.5C4,27.328 4.672,28 5.5,28L6.5,28C7.328,28 8,27.328 8,26.5L8,25.5ZM32,10.5C32,9.12 30.88,8 29.5,8L6.5,8C5.12,8 4,9.12 4,10.5L4,19.5C4,20.88 5.12,22 6.5,22L29.5,22C30.88,22 32,20.88 32,19.5L32,10.5ZM30,10.5C30,10.224 29.776,10 29.5,10L6.5,10C6.224,10 6,10.224 6,10.5L6,19.5C6,19.776 6.224,20 6.5,20L29.5,20C29.776,20 30,19.776 30,19.5L30,10.5Z'],
  ]],
  search: [18, 18, [
    [1, 'M23.327,24.742C21.603,26.153 19.4,27 17,27C11.481,27 7,22.519 7,17C7,11.481 11.481,7 17,7C22.519,7 27,11.481 27,17C27,19.4 26.153,21.603 24.742,23.327L31.707,30.293L30.293,31.707L23.327,24.742ZM17,9C21.415,9 25,12.585 25,17C25,21.415 21.415,25 17,25C12.585,25 9,21.415 9,17C9,12.585 12.585,9 17,9Z'],
  ]],
  checkmark: [14, 14, [
    [1, 'M12.205,17.377L19.822,7.222C20.484,6.339 21.529,5.949 22.412,6.612C23.295,7.274 23.262,8.317 22.6,9.2L13.6,21.2C13.252,21.664 12.814,21.796 12.236,21.837C11.657,21.878 11.219,21.601 10.809,21.191L5.809,16.191C5.029,15.41 4.931,14.24 5.712,13.46C6.492,12.679 7.634,12.805 8.414,13.586L12.205,17.377Z'],
  ]],
  mixed: [14, 14, [
    [1, 'M22,13.94C22,12.836 21.104,11.94 20,11.94L8,11.94C6.896,11.94 6,12.836 6,13.94C6,15.044 6.896,15.94 8,15.94L20,15.94C21.104,15.94 22,15.044 22,13.94Z'],
  ]],
  nsChevron: [14, 14, [
    [1, 'M12.852,25.853C13.404,26.117 14.085,26.024 14.547,25.574L20.561,19.56C21.146,18.975 21.146,18.024 20.561,17.439C19.976,16.854 19.025,16.854 18.44,17.439L13.5,22.378L8.561,17.439C7.976,16.854 7.025,16.854 6.44,17.439C5.854,18.024 5.854,18.975 6.44,19.56L12.467,25.587L12.69,25.763L12.852,25.853ZM12.852,2.147C13.404,1.883 14.085,1.976 14.547,2.426L20.561,8.439C21.146,9.025 21.146,9.975 20.561,10.561C19.975,11.146 19.025,11.146 18.439,10.561L13.5,5.621L8.561,10.561C7.975,11.146 7.025,11.146 6.439,10.561C5.854,9.975 5.854,9.025 6.439,8.439L12.467,2.412L12.69,2.237L12.852,2.147Z'],
  ]],
  windowClose: [12, 12, [
    [.55, 'M12,10.586L16.293,6.293C16.683,5.903 17.317,5.903 17.707,6.293C18.097,6.683 18.097,7.317 17.707,7.707L13.414,12L17.707,16.293C18.097,16.683 18.097,17.317 17.707,17.707C17.317,18.097 16.683,18.097 16.293,17.707L12,13.414L7.707,17.707C7.317,18.097 6.683,18.097 6.293,17.707C5.903,17.317 5.903,16.683 6.293,16.293L10.586,12L6.293,7.707C5.903,7.317 5.903,6.683 6.293,6.293C6.683,5.903 7.317,5.903 7.707,6.293L12,10.586Z'],
  ]],
  windowMinimize: [12, 12, [
    [.55, 'M5,13L19,13C19.552,13 20,12.552 20,12C20,11.448 19.552,11 19,11L5,11C4.448,11 4,11.448 4,12C4,12.552 4.448,13 5,13Z'],
  ]],
  windowMaximize: [12, 12, [
    [.55, 'M15,18L6,9C6,9 6,14.256 6,16C6,17.104 6.896,18 8,18L15,18ZM9,6L18,15C18,15 18,9.744 18,8C18,6.896 17.104,6 16,6L9,6Z'],
  ]],
  appleMenu: [22, 22, [
    [.95, 'M34.219,28.783C33.761,29.857 33.219,30.845 32.591,31.753C31.735,32.991 31.034,33.849 30.494,34.325C29.657,35.106 28.759,35.506 27.799,35.529C27.109,35.529 26.277,35.33 25.309,34.926C24.337,34.524 23.444,34.325 22.628,34.325C21.772,34.325 20.854,34.524 19.872,34.926C18.888,35.33 18.096,35.54 17.49,35.561C16.568,35.601 15.65,35.189 14.733,34.325C14.148,33.807 13.416,32.919 12.54,31.662C11.599,30.32 10.826,28.763 10.22,26.988C9.571,25.07 9.246,23.214 9.246,21.416C9.246,19.358 9.684,17.582 10.563,16.094C11.253,14.899 12.172,13.956 13.321,13.263C14.47,12.571 15.712,12.219 17.05,12.196C17.782,12.196 18.741,12.426 19.934,12.877C21.123,13.33 21.887,13.559 22.222,13.559C22.472,13.559 23.32,13.291 24.758,12.756C26.118,12.259 27.266,12.054 28.206,12.135C30.754,12.343 32.668,13.362 33.941,15.198C31.662,16.598 30.535,18.56 30.558,21.077C30.578,23.037 31.279,24.668 32.657,25.964C33.281,26.565 33.978,27.029 34.754,27.359C34.586,27.854 34.408,28.328 34.219,28.783ZM28,4C27.994,5.747 27.376,7.496 26.318,8.808C25.26,10.121 23.763,10.997 22,11C22.021,7.486 24.441,4.011 28,4Z'],
  ]],
  mCheck: [14, 14, [
    [.95, 'M11.579,18.744L20.605,4.898C21.202,3.983 22.429,3.725 23.344,4.321C24.259,4.918 24.518,6.145 23.921,7.06L13.463,23.102C13.124,23.622 12.561,23.952 11.942,23.995C11.323,24.038 10.719,23.788 10.312,23.32L4.887,17.081C4.17,16.256 4.257,15.005 5.082,14.288C5.906,13.572 7.157,13.659 7.874,14.483L11.579,18.744Z'],
  ]],
  chevronUpSmall: [11, 10, [
    [1, 'M5.414,14.586C5.149,14.32 5,13.961 5,13.586C5,13.211 5.149,12.851 5.414,12.586C6.593,11.407 8.33,9.67 9.293,8.707C9.746,8.254 10.36,8 11,8C11,8 11,8 11,8C11.64,8 12.254,8.254 12.707,8.707C13.627,9.627 15.272,11.272 16.586,12.586C17.138,13.138 17.138,14.033 16.586,14.586C16.586,14.586 16.586,14.586 16.586,14.586C16.32,14.851 15.961,15 15.586,15C15.211,15 14.851,14.851 14.586,14.586C12.879,12.879 11,11 11,11C11,11 8.873,13.127 7.414,14.586C6.862,15.138 5.967,15.138 5.414,14.586C5.414,14.586 5.414,14.586 5.414,14.586Z'],
  ]],
  chevronDownSmall: [11, 10, [
    [1, 'M5.414,5.414C5.149,5.68 5,6.039 5,6.414C5,6.789 5.149,7.149 5.414,7.414C6.593,8.593 8.33,10.33 9.293,11.293C9.746,11.746 10.36,12 11,12C11,12 11,12 11,12C11.64,12 12.254,11.746 12.707,11.293C13.627,10.373 15.272,8.728 16.586,7.414C17.138,6.862 17.138,5.967 16.586,5.414C16.586,5.414 16.586,5.414 16.586,5.414C16.32,5.149 15.961,5 15.586,5C15.211,5 14.851,5.149 14.586,5.414C12.879,7.121 11,9 11,9C11,9 8.873,6.873 7.414,5.414C6.862,4.862 5.967,4.862 5.414,5.414C5.414,5.414 5.414,5.414 5.414,5.414Z'],
  ]],
  add: [11, 11, [
    [1, "M12,10L22,10L22,12L12,12L12,22L10,22L10,12L0,12L0,10L10,10L10,0L12,0L12,10Z"],
  ]],
  remove: [11, 11, [
    [1, "M22,10L22,12L0,12L0,10Z"],
  ]],
};

export const sidebarDesktopFolderIcon = pathsIcon(icons.sidebarDesktopFolder);
export const sidebarGenericFolderIcon = pathsIcon(icons.sidebarGenericFolder);
export const sidebariCloudIcon = pathsIcon(icons.sidebariCloud);
export const sidebarDocumentsFolderIcon = pathsIcon(icons.sidebarDocumentsFolder);
export const sidebarDownloadsFolderIcon = pathsIcon(icons.sidebarDownloadsFolder);
export const sidebarMoviesFolderIcon = pathsIcon(icons.sidebarMoviesFolder);
export const caretRightIcon = pathsIcon(icons.caretRight);
export const caretDownIcon = pathsIcon(icons.caretDown);
export const checkmark = pathsIcon(icons.checkmark);
export const iconsIcon = pathsIcon(icons.icons);
export const listIcon = pathsIcon(icons.list);
export const columnsIcon = pathsIcon(icons.columns);
export const galleryIcon = pathsIcon(icons.gallery);
export const searchIcon = pathsIcon(icons.search);
export const mixedIcon = pathsIcon(icons.mixed);
export const nsChevronIcon = pathsIcon(icons.nsChevron);
export const menuCheckIcon = pathsIcon(icons.mCheck);
export const windowCloseIcon = pathsIcon(icons.windowClose);
export const windowMinimizeIcon = pathsIcon(icons.windowMinimize);
export const windowMaximizeIcon = pathsIcon(icons.windowMaximize);
export const appleMenuIcon = pathsIcon(icons.appleMenu);
export const smallChevronUpIcon = pathsIcon(icons.chevronUpSmall);
export const smallChevronDownIcon = pathsIcon(icons.chevronDownSmall);
export const addIcon = pathsIcon(icons.add);
export const removeIcon = pathsIcon(icons.remove);
