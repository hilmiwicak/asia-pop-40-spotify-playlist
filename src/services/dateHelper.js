/** 
 * function to help date suffix
 */
const nth = (date) => {
    if (date >= 4 && date <= 20) return "th";
    switch (date % 10) {
        case 1: return "st";
        case 2: return "nd";
        case 3: return "rd";
        default: return "th";
    }
}

/**
 * function to help month to become more readable
 */
const monthToHuman = (month) => {
    switch (month) {
        case 0: return "January";
        case 1: return "February";
        case 2: return "March";
        case 3: return "April";
        case 4: return "May";
        case 5: return "June";
        case 6: return "July";
        case 7: return "August";
        case 8: return "September";
        case 9: return "October";
        case 10: return "November";
        case 11: return "December";
    }
}

export {
    nth,
    monthToHuman
};
